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
}): Promise<void> {
  const { engine, containerName, database } = options;
  await waitForPostgresReady({ containerName, user: engine.user });
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
}): Promise<boolean> {
  const { engine, containerName, database } = options;
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
}): Promise<void> {
  const { engine, containerName, database } = options;
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

async function ensureMongoReady(
  engine: AppDbEngine,
  containerName: string
): Promise<void> {
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

export async function provisionWorkspaceEngine(
  workspaceId: string,
  engineId: AppDbEngineId
): Promise<ProvisionedWorkspaceEngine> {
  if (!appDbEnabled()) {
    throw new Error("App databases are disabled (FORGE_APP_DB_ENABLED=0)");
  }
  const engine = getAppDbEngine(engineId);
  if (!engine) throw new Error(`Unknown engine: ${engineId}`);
  const ensured = await ensureEngineRunning(engine);
  const database = workspaceDbName(workspaceId);
  if (engine.id === "postgres") {
    await createPostgresDatabase({
      engine,
      containerName: ensured.containerName,
      database
    });
  } else {
    await ensureMongoReady(engine, ensured.containerName);
  }
  return {
    engineId: engine.id,
    label: engine.label,
    image: engine.image,
    database,
    envKey: engine.envKey,
    connectionUrl: connectionUrlFor(engine, database),
    containerName: ensured.containerName,
    networkAlias: engine.networkAlias,
    hostPort: engine.hostPort,
    engineRunning: true,
    reused: ensured.reused,
    pulled: ensured.pulled
  };
}

export async function ensureAttachedWorkspaceEngines(
  workspaceId: string,
  engineIds: AppDbEngineId[]
): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  if (!appDbEnabled()) return env;
  for (const id of engineIds) {
    const provisioned = await provisionWorkspaceEngine(workspaceId, id);
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
}): Promise<EngineStatusRow[]> {
  const attached = new Set(options.attachedEngineIds);
  const database = workspaceDbName(options.workspaceId);
  const rows: EngineStatusRow[] = [];
  for (const engine of APP_DB_ENGINES) {
    const running = await isEngineRunning(engine);
    let dbExists = false;
    if (running && attached.has(engine.id) && engine.id === "postgres") {
      const container = await resolveEngineContainer(engine);
      if (container) {
        dbExists = await postgresDatabaseExists({
          engine,
          containerName: container,
          database
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

export async function detachWorkspaceEngine(
  workspaceId: string,
  engineId: AppDbEngineId
): Promise<void> {
  const engine = getAppDbEngine(engineId);
  if (!engine) return;
  const container = await resolveEngineContainer(engine);
  if (!container) return;
  const database = workspaceDbName(workspaceId);
  if (engine.id === "postgres") {
    await dropPostgresDatabase({
      engine,
      containerName: container,
      database
    });
  }
}
