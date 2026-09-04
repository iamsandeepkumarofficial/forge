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
  workspaceId: string
): Promise<SessionAppDbEnv> {
  if (!appDbEnabled()) return {};
  const repo = new WorkspaceDatabaseRepository();
  const rows = await repo.list(workspaceId);
  const env: SessionAppDbEnv = {};
  const database = workspaceDbName(workspaceId);
  for (const row of rows) {
    const engine = getAppDbEngine(row.engineId);
    if (!engine) continue;
    env[engine.envKey] = connectionUrlFor(engine, database);
  }
  return env;
}


export function sessionAppDbEnvFor(sessionId: string): SessionAppDbEnv {
  if (!appDbEnabled()) return {};
  
  
  const engine = getAppDbEngine("postgres");
  if (!engine) return {};
  return {
    DATABASE_URL: connectionUrlFor(engine, sessionDbName(sessionId))
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

async function injectParam(
  workspaceId: string,
  key: string,
  value: string
): Promise<void> {
  const paramRepo = new ParameterRepository();
  await paramRepo.upsertWorkspaceParameter({
    workspaceId,
    key,
    value,
    secret: isLikelySecretKey(key)
  });
}


export async function attachWorkspaceDatabase(
  workspaceId: string,
  engineId: AppDbEngineId
): Promise<ProvisionedWorkspaceEngine> {
  const provisioned = await provisionWorkspaceEngine(workspaceId, engineId);
  const repo = new WorkspaceDatabaseRepository();
  await repo.attach({
    workspaceId,
    engineId: provisioned.engineId,
    databaseName: provisioned.database
  });
  await injectParam(workspaceId, provisioned.envKey, provisioned.connectionUrl);
  return provisioned;
}

export async function detachWorkspaceDatabase(
  workspaceId: string,
  engineId: AppDbEngineId
): Promise<void> {
  await detachWorkspaceEngine(workspaceId, engineId);
  const repo = new WorkspaceDatabaseRepository();
  await repo.detach(workspaceId, engineId);
  const engine = getAppDbEngine(engineId);
  if (engine) {
    const paramRepo = new ParameterRepository();
    await paramRepo.deleteWorkspaceParameter(workspaceId, engine.envKey);
  }
}


export async function provisionWorkspaceAppDatabases(
  workspaceId: string
): Promise<SessionAppDbEnv> {
  if (!appDbEnabled()) return {};
  const repo = new WorkspaceDatabaseRepository();
  const rows = await repo.list(workspaceId);
  const ids = rows
    .map((r) => r.engineId)
    .filter((id): id is AppDbEngineId => Boolean(getAppDbEngine(id)));
  const env = await ensureAttachedWorkspaceEngines(workspaceId, ids);
  for (const [key, value] of Object.entries(env)) {
    await injectParam(workspaceId, key, value);
  }
  return env;
}


export async function provisionDetectedWorkspaceDatabases(
  workspaceId: string,
  engineIds: AppDbEngineId[]
): Promise<SessionAppDbEnv> {
  const env: SessionAppDbEnv = {};
  for (const id of engineIds) {
    const provisioned = await attachWorkspaceDatabase(workspaceId, id);
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
  const ensured = await ensureEngineRunning(engine);
  const database = sessionDbName(sessionId);
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const { waitForPostgresReady } = await import("./appDb/ensureEngine.js");
  await waitForPostgresReady(ensured.containerName, engine.user);
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
      console.warn(`[sessionAppDb] create session postgres db ${database}: ${msg}`);
    }
  }
  return {
    DATABASE_URL: connectionUrlFor(engine, database)
  };
}

export async function destroySessionAppDatabases(
  sessionId: string
): Promise<void> {
  if (!appDbEnabled()) return;
  const engine = getAppDbEngine("postgres");
  if (!engine) return;
  const { resolveEngineContainer } = await import("./appDb/ensureEngine.js");
  const container = await resolveEngineContainer(engine);
  if (!container) return;
  const database = sessionDbName(sessionId);
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


export function describeWorkspaceAppDatabases(
  workspaceId: string,
  provisioned: { postgres: boolean; mongo: boolean }
): {
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
  const db = workspaceDbName(workspaceId);
  const pg = getAppDbEngine("postgres")!;
  const mongo = getAppDbEngine("mongo")!;
  return {
    enabled: appDbEnabled(),
    network: "forge",
    postgres: {
      provisioned: provisioned.postgres,
      database: db,
      sandboxHost: pg.networkAlias,
      sandboxPort: pg.containerPort,
      hostAddress: "127.0.0.1",
      hostPort: pg.hostPort,
      injectedAs: "DATABASE_URL"
    },
    mongo: {
      provisioned: provisioned.mongo,
      database: db,
      sandboxHost: mongo.networkAlias,
      sandboxPort: mongo.containerPort,
      hostAddress: "127.0.0.1",
      hostPort: mongo.hostPort,
      injectedAs: "MONGODB_URI"
    }
  };
}
