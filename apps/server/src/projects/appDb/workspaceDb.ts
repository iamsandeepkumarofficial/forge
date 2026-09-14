import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  type AppDbEngine,
  type AppDbEngineId,
  APP_DB_ENGINES,
  appDbEnabled,
  connectionUrlFor,
  getAppDbEngine,
  workspaceDbName
} from "./engines.js";
import {
  ensureEngineRunning,
  isEngineRunning,
  resolveEngineContainer,
  waitForPostgresReady
} from "./ensureEngine.js";

const execFileAsync = promisify(execFile);
const N_16 = 16;
const N_30 = 30;
const N_500 = 500;
const N_1024 = 1024;

async function docker(
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("docker", args, {
    maxBuffer: N_16 * N_1024 * N_1024,
    env: process.env
  });
}

async function createPostgresDatabase(options: {
  engine: AppDbEngine;
  containerName: string;
  database: string;
  hostMode?: boolean;
}): Promise<void> {
  const { engine, containerName, database } = options;
  if (options.hostMode) {
    const { createHostPostgresDatabase } = await import("./hostAppDb.js");
    await createHostPostgresDatabase({ engine, database });
    return;
  }
  await waitForPostgresReady({
    containerName,
    user: engine.user,
    engine
  });
  try {
    await docker([
      "exec",
      containerName,
      "psql",
      "-U",
      engine.user,
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `CREATE DATABASE "${database}"`
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists/i.test(msg)) throw err;
  }
}

async function postgresDatabaseExists(options: {
  engine: AppDbEngine;
  containerName: string;
  database: string;
  hostMode?: boolean;
}): Promise<boolean> {
  const { engine, containerName, database } = options;
  if (options.hostMode) {
    const { hostPostgresDatabaseExists } = await import("./hostAppDb.js");
    return hostPostgresDatabaseExists({ engine, database });
  }
  try {
    const { stdout } = await docker([
      "exec",
      containerName,
      "psql",
      "-U",
      engine.user,
      "-d",
      "postgres",
      "-tAc",
      `SELECT 1 FROM pg_database WHERE datname = '${database}'`
    ]);
    return stdout.trim() === "1";
  } catch {
    return false;
  }
}

async function dropPostgresDatabase(options: {
  engine: AppDbEngine;
  containerName: string;
  database: string;
  hostMode?: boolean;
}): Promise<void> {
  const { engine, containerName, database } = options;
  if (options.hostMode) {
    const { dropHostPostgresDatabase } = await import("./hostAppDb.js");
    await dropHostPostgresDatabase({ engine, database });
    return;
  }
  await docker([
    "exec",
    containerName,
    "psql",
    "-U",
    engine.user,
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`
  ]).catch(() => undefined);
}

async function ensureMongoReady(options: {
  engine: AppDbEngine;
  containerName: string;
  hostMode?: boolean;
}): Promise<void> {
  const { engine, containerName } = options;
  const hostMode = options.hostMode ?? false;
  if (hostMode) {
    const { ensureHostMongoReady } = await import("./hostAppDb.js");
    await ensureHostMongoReady(engine);
    return;
  }
  for (let i = 0; i < N_30; i++) {
    try {
      await docker([
        "exec",
        containerName,
        "mongosh",
        "-u",
        engine.user,
        "-p",
        engine.password,
        "--authenticationDatabase",
        "admin",
        "--eval",
        "db.runCommand({ ping: 1 })"
      ]);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, N_500));
    }
  }
  throw new Error(`Mongo ${containerName} did not become ready`);
}

export type ProvisionedWorkspaceEngine = {
  engineId: AppDbEngineId;
  label: string;
  image: string;
  database: string;
  envKey: string;
  connectionUrl: string;
  containerName: string;
  networkAlias: string;
  hostPort: number;
  engineRunning: boolean;
  reused: boolean;
  pulled: boolean;
};

export async function provisionWorkspaceEngine(options: {
  workspaceId: string;
  engineId: AppDbEngineId;
  hostMode?: boolean;
  sessionId?: string;
}): Promise<ProvisionedWorkspaceEngine> {
  if (!appDbEnabled()) {
    throw new Error("App databases are disabled (FORGE_APP_DB_ENABLED=0)");
  }
  const engine = getAppDbEngine(options.engineId);
  if (!engine) throw new Error(`Unknown engine: ${options.engineId}`);
  const hostMode =
    options.hostMode ??
    (options.sessionId
      ? await (
          await import("../sandboxRuntime/resolve.js")
        ).isHostSession(options.sessionId)
      : false);
  const ensured = await ensureEngineRunning(engine, {
    hostMode,
    sessionId: options.sessionId
  });
  const database = workspaceDbName(options.workspaceId);
  if (engine.id === "postgres") {
    await createPostgresDatabase({
      engine,
      containerName: ensured.containerName,
      database,
      hostMode
    });
  } else {
    await ensureMongoReady({
      engine,
      containerName: ensured.containerName,
      hostMode
    });
  }
  return {
    engineId: engine.id,
    label: engine.label,
    image: engine.image,
    database,
    envKey: engine.envKey,
    connectionUrl: connectionUrlFor({ engine, database, hostMode }),
    containerName: ensured.containerName,
    networkAlias: engine.networkAlias,
    hostPort: engine.hostPort,
    engineRunning: true,
    reused: ensured.reused,
    pulled: ensured.pulled
  };
}

export async function ensureAttachedWorkspaceEngines(options: {
  workspaceId: string;
  engineIds: AppDbEngineId[];
  hostMode?: boolean;
  sessionId?: string;
}): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  if (!appDbEnabled()) return env;
  for (const id of options.engineIds) {
    const provisioned = await provisionWorkspaceEngine({
      workspaceId: options.workspaceId,
      engineId: id,
      hostMode: options.hostMode,
      sessionId: options.sessionId
    });
    env[provisioned.envKey] = provisioned.connectionUrl;
  }
  return env;
}

export type EngineStatusRow = {
  id: AppDbEngineId;
  label: string;
  image: string;
  envKey: string;
  networkAlias: string;
  hostPort: number;
  engineRunning: boolean;
  attached: boolean;
  database: string | null;
};

export async function listEngineStatuses(options: {
  workspaceId: string;
  attachedEngineIds: AppDbEngineId[];
  hostMode?: boolean;
}): Promise<EngineStatusRow[]> {
  const attached = new Set(options.attachedEngineIds);
  const database = workspaceDbName(options.workspaceId);
  const hostMode = options.hostMode ?? false;
  const rows: EngineStatusRow[] = [];
  for (const engine of APP_DB_ENGINES) {
    const running = await isEngineRunning(engine, { hostMode });
    let dbExists = false;
    if (running && attached.has(engine.id) && engine.id === "postgres") {
      const container = await resolveEngineContainer(engine, { hostMode });
      if (container) {
        dbExists = await postgresDatabaseExists({
          engine,
          containerName: container,
          database,
          hostMode
        });
      }
    } else if (attached.has(engine.id) && engine.id === "mongo") {
      dbExists = running;
    }
    rows.push({
      id: engine.id,
      label: engine.label,
      image: engine.image,
      envKey: engine.envKey,
      networkAlias: engine.networkAlias,
      hostPort: engine.hostPort,
      engineRunning: running,
      attached: attached.has(engine.id),
      database: attached.has(engine.id) ? database : null
    });
    void dbExists;
  }
  return rows;
}

export async function detachWorkspaceEngine(options: {
  workspaceId: string;
  engineId: AppDbEngineId;
  hostMode?: boolean;
}): Promise<void> {
  const engine = getAppDbEngine(options.engineId);
  if (!engine) return;
  const hostMode = options.hostMode ?? false;
  const container = await resolveEngineContainer(engine, { hostMode });
  if (!container) return;
  const database = workspaceDbName(options.workspaceId);
  if (engine.id === "postgres") {
    await dropPostgresDatabase({
      engine,
      containerName: container,
      database,
      hostMode
    });
  }
}
