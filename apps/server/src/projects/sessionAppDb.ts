import { ParameterRepository } from "../catalog/parameterRepository.js";
import { WorkspaceDatabaseRepository } from "../catalog/workspaceDatabaseRepository.js";
import { isLikelySecretKey } from "./repoFacts.js";
import {
  type AppDbEngineId,
  appDbEnabled,
  connectionUrlFor,
  getAppDbEngine,
  sessionDbName,
  workspaceDbName
} from "./appDb/engines.js";
import { ensureEngineRunning } from "./appDb/ensureEngine.js";
import { isHostSession } from "./sandboxRuntime/resolve.js";
import {
  detachWorkspaceEngine,
  ensureAttachedWorkspaceEngines,
  listEngineStatuses,
  provisionWorkspaceEngine,
  type EngineStatusRow,
  type ProvisionedWorkspaceEngine
} from "./appDb/workspaceDb.js";

export {
  appDbEnabled,
  sandboxNetworkName,
  workspaceDbName,
  sessionDbName,
  APP_DB_ENGINES,
  getAppDbEngine,
  detectEnginesFromFacts,
  type AppDbEngineId
} from "./appDb/engines.js";

export type SessionAppDbEnv = {
  DATABASE_URL?: string;
  MONGODB_URI?: string;
};

export async function workspaceAppDbEnv(
  workspaceId: string,
  options?: { sessionId?: string; hostMode?: boolean }
): Promise<SessionAppDbEnv> {
  if (!appDbEnabled()) return {};
  const hostMode =
    options?.hostMode ??
    (options?.sessionId ? await isHostSession(options.sessionId) : false);
  const repo = new WorkspaceDatabaseRepository();
  const rows = await repo.list(workspaceId);
  const env: SessionAppDbEnv = {};
  const database = workspaceDbName(workspaceId);
  for (const row of rows) {
    const engine = getAppDbEngine(row.engineId);
    if (!engine) continue;
    env[engine.envKey] = connectionUrlFor({ engine, database, hostMode });
  }
  return env;
}

export async function sessionAppDbEnvFor(
  sessionId: string
): Promise<SessionAppDbEnv> {
  if (!appDbEnabled()) return {};

  const engine = getAppDbEngine("postgres");
  if (!engine) return {};
  const hostMode = await isHostSession(sessionId);
  return {
    DATABASE_URL: connectionUrlFor({
      engine,
      database: sessionDbName(sessionId),
      hostMode
    })
  };
}

export async function loadWorkspaceAppDbStatus(workspaceId: string): Promise<{
  enabled: boolean;
  network: string;
  engines: EngineStatusRow[];
}> {
  const { sandboxNetworkName } = await import("./appDb/engines.js");
  const repo = new WorkspaceDatabaseRepository();
  const attached = (await repo.list(workspaceId)).map(
    (r) => r.engineId as AppDbEngineId
  );
  return {
    enabled: appDbEnabled(),
    network: sandboxNetworkName(),
    engines: await listEngineStatuses({
      workspaceId,
      attachedEngineIds: attached
    })
  };
}

async function injectParam(options: {
  workspaceId: string;
  key: string;
  value: string;
}): Promise<void> {
  const paramRepo = new ParameterRepository();
  await paramRepo.upsertWorkspaceParameter({
    workspaceId: options.workspaceId,
    key: options.key,
    value: options.value,
    secret: isLikelySecretKey(options.key)
  });
}

export async function attachWorkspaceDatabase(options: {
  workspaceId: string;
  engineId: AppDbEngineId;
  hostMode?: boolean;
  sessionId?: string;
}): Promise<ProvisionedWorkspaceEngine> {
  const provisioned = await provisionWorkspaceEngine({
    workspaceId: options.workspaceId,
    engineId: options.engineId,
    hostMode: options.hostMode,
    sessionId: options.sessionId
  });
  const repo = new WorkspaceDatabaseRepository();
  await repo.attach({
    workspaceId: options.workspaceId,
    engineId: provisioned.engineId,
    databaseName: provisioned.database
  });
  await injectParam({
    workspaceId: options.workspaceId,
    key: provisioned.envKey,
    value: provisioned.connectionUrl
  });
  return provisioned;
}

export async function detachWorkspaceDatabase(options: {
  workspaceId: string;
  engineId: AppDbEngineId;
  hostMode?: boolean;
}): Promise<void> {
  await detachWorkspaceEngine({
    workspaceId: options.workspaceId,
    engineId: options.engineId,
    hostMode: options.hostMode
  });
  const repo = new WorkspaceDatabaseRepository();
  await repo.detach(options.workspaceId, options.engineId);
  const engine = getAppDbEngine(options.engineId);
  if (engine) {
    const paramRepo = new ParameterRepository();
    await paramRepo.deleteWorkspaceParameter(
      options.workspaceId,
      engine.envKey
    );
  }
}

export async function provisionWorkspaceAppDatabases(
  workspaceId: string,
  options?: { hostMode?: boolean; sessionId?: string }
): Promise<SessionAppDbEnv> {
  if (!appDbEnabled()) return {};
  const repo = new WorkspaceDatabaseRepository();
  const rows = await repo.list(workspaceId);
  const ids = rows
    .map((r) => r.engineId)
    .filter((id): id is AppDbEngineId => Boolean(getAppDbEngine(id)));
  const env = await ensureAttachedWorkspaceEngines({
    workspaceId,
    engineIds: ids,
    hostMode: options?.hostMode,
    sessionId: options?.sessionId
  });
  for (const [key, value] of Object.entries(env)) {
    await injectParam({ workspaceId, key, value });
  }
  return env;
}

export async function provisionDetectedWorkspaceDatabases(options: {
  workspaceId: string;
  engineIds: AppDbEngineId[];
  hostMode?: boolean;
  sessionId?: string;
}): Promise<SessionAppDbEnv> {
  const env: SessionAppDbEnv = {};
  for (const id of options.engineIds) {
    const provisioned = await attachWorkspaceDatabase({
      workspaceId: options.workspaceId,
      engineId: id,
      hostMode: options.hostMode,
      sessionId: options.sessionId
    });
    env[provisioned.envKey as keyof SessionAppDbEnv] =
      provisioned.connectionUrl;
  }
  return env;
}

export async function provisionSessionAppDatabases(
  sessionId: string
): Promise<SessionAppDbEnv> {
  if (!appDbEnabled()) return {};
  const engine = getAppDbEngine("postgres");
  if (!engine) return {};
  const hostMode = await isHostSession(sessionId);
  const ensured = await ensureEngineRunning(engine, { hostMode, sessionId });
  const database = sessionDbName(sessionId);
  const { waitForPostgresReady } = await import("./appDb/ensureEngine.js");
  await waitForPostgresReady({
    containerName: ensured.containerName,
    user: engine.user,
    engine,
    hostMode,
    sessionId
  });
  if (hostMode) {
    const { createHostPostgresDatabase } = await import("./appDb/hostAppDb.js");
    await createHostPostgresDatabase({ engine, database }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists/i.test(msg)) {
        console.warn(
          `[sessionAppDb] create session postgres db ${database}: ${msg}`
        );
      }
    });
  } else {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    try {
      await execFileAsync(
        "docker",
        [
          "exec",
          ensured.containerName,
          "psql",
          "-U",
          engine.user,
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          `CREATE DATABASE "${database}"`
        ],
        { env: process.env }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists/i.test(msg)) {
        console.warn(
          `[sessionAppDb] create session postgres db ${database}: ${msg}`
        );
      }
    }
  }
  return {
    DATABASE_URL: connectionUrlFor({ engine, database, hostMode })
  };
}

export async function destroySessionAppDatabases(
  sessionId: string
): Promise<void> {
  if (!appDbEnabled()) return;
  const engine = getAppDbEngine("postgres");
  if (!engine) return;
  const hostMode = await isHostSession(sessionId);
  const database = sessionDbName(sessionId);
  if (hostMode) {
    const { dropHostPostgresDatabase } = await import("./appDb/hostAppDb.js");
    await dropHostPostgresDatabase({ engine, database }).catch((err) => {
      console.warn(
        `[sessionAppDb] drop postgres ${database}: ${err instanceof Error ? err.message : String(err)}`
      );
    });
    return;
  }
  const { resolveEngineContainer } = await import("./appDb/ensureEngine.js");
  const container = await resolveEngineContainer(engine, { hostMode: false });
  if (!container) return;
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  try {
    await execFileAsync(
      "docker",
      [
        "exec",
        container,
        "psql",
        "-U",
        engine.user,
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`
      ],
      { env: process.env }
    );
  } catch (err) {
    console.warn(
      `[sessionAppDb] drop postgres ${database}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function describeWorkspaceAppDatabases(options: {
  workspaceId: string;
  provisioned: { postgres: boolean; mongo: boolean };
  hostMode?: boolean;
}): {
  enabled: boolean;
  network: string;
  postgres: {
    provisioned: boolean;
    database: string;
    sandboxHost: string;
    sandboxPort: number;
    hostAddress: string;
    hostPort: number;
    injectedAs: "DATABASE_URL";
  };
  mongo: {
    provisioned: boolean;
    database: string;
    sandboxHost: string;
    sandboxPort: number;
    hostAddress: string;
    hostPort: number;
    injectedAs: "MONGODB_URI";
  };
} {
  const hostMode = options.hostMode ?? false;
  const db = workspaceDbName(options.workspaceId);
  const pg = getAppDbEngine("postgres")!;
  const mongo = getAppDbEngine("mongo")!;
  return {
    enabled: appDbEnabled(),
    network: hostMode ? "localhost" : "forge",
    postgres: {
      provisioned: options.provisioned.postgres,
      database: db,
      sandboxHost: hostMode ? "127.0.0.1" : pg.networkAlias,
      sandboxPort: hostMode ? pg.hostPort : pg.containerPort,
      hostAddress: "127.0.0.1",
      hostPort: pg.hostPort,
      injectedAs: "DATABASE_URL"
    },
    mongo: {
      provisioned: options.provisioned.mongo,
      database: db,
      sandboxHost: hostMode ? "127.0.0.1" : mongo.networkAlias,
      sandboxPort: hostMode ? mongo.hostPort : mongo.containerPort,
      hostAddress: "127.0.0.1",
      hostPort: mongo.hostPort,
      injectedAs: "MONGODB_URI"
    }
  };
}
