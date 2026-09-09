import {
  execFile,
  execFileSync,
  spawn,
  type ChildProcess
} from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import type { AppDbEngine } from "./engines.js";

const execFileAsync = promisify(execFile);
const N_30 = 30;
const N_500 = 500;
const N_1024 = 1024;
const N_8 = 8;

export type HostEnsureEngineResult = {
  engineId: string;
  containerName: string;
  networkAlias: string;
  reused: boolean;
  pulled: boolean;
};

const children = new Map<string, ChildProcess>();

function appDbHome(): string {
  return join(homedir(), ".forge", "appdb");
}

function which(cmd: string): string | null {
  try {
    const out = execFileSync(
      process.platform === "win32" ? "where" : "which",
      [cmd],
      { encoding: "utf8" }
    );
    return out.trim().split(/\r?\n/)[0]?.trim() || null;
  } catch {
    return null;
  }
}

function resolveBin(name: string): string {
  const runtime = join(homedir(), ".forge", "runtime", "bin", name);
  if (existsSync(runtime)) return runtime;
  const brew = [
    `/opt/homebrew/opt/postgresql@16/bin/${name}`,
    `/usr/local/opt/postgresql@16/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`
  ];
  for (const c of brew) {
    if (existsSync(c)) return c;
  }
  const fromPath = which(name);
  if (fromPath) return fromPath;
  throw new Error(
    `Missing \`${name}\` for host-mode app DB. Call install_project_infra after user approval, or place binaries in ~/.forge/runtime/bin/. Use a Cloud (Docker) session for compose app DBs.`
  );
}

export async function isTcpListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(N_500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function pgHbaTrust(): string {
  return [
    "local all all trust",
    "host all all 127.0.0.1/32 trust",
    "host all all ::1/128 trust",
    ""
  ].join("\n");
}

async function initPostgresData(
  engine: AppDbEngine,
  data: string
): Promise<void> {
  if (existsSync(join(data, "PG_VERSION"))) return;
  mkdirSync(data, { recursive: true });
  const initdb = resolveBin("initdb");
  await execFileAsync(initdb, [
    "-D",
    data,
    "-U",
    engine.user,
    "--auth-local=trust",
    "--auth-host=trust"
  ]);
  writeFileSync(join(data, "pg_hba.conf"), pgHbaTrust());
}

async function ensureHostPostgres(
  engine: AppDbEngine
): Promise<HostEnsureEngineResult> {
  if (await isTcpListening(engine.hostPort)) {
    return {
      engineId: engine.id,
      containerName: `host:${engine.id}`,
      networkAlias: "127.0.0.1",
      reused: true,
      pulled: false
    };
  }
  const data = join(appDbHome(), "postgres", "data");
  const run = join(appDbHome(), "postgres", "run");
  mkdirSync(run, { recursive: true });
  await initPostgresData(engine, data);
  const postgres = resolveBin("postgres");
  const child = spawn(
    postgres,
    [
      "-D",
      data,
      "-p",
      String(engine.hostPort),
      "-h",
      "127.0.0.1",
      "-k",
      run,
      "-c",
      "logging_collector=off",
      "-c",
      "log_destination=stderr"
    ],
    { stdio: "ignore", detached: process.platform !== "win32" }
  );
  children.set(engine.id, child);
  await waitForHostPostgresReady(engine);
  return {
    engineId: engine.id,
    containerName: `host:${engine.id}`,
    networkAlias: "127.0.0.1",
    reused: false,
    pulled: false
  };
}

async function ensureHostMongo(
  engine: AppDbEngine
): Promise<HostEnsureEngineResult> {
  if (await isTcpListening(engine.hostPort)) {
    return {
      engineId: engine.id,
      containerName: `host:${engine.id}`,
      networkAlias: "127.0.0.1",
      reused: true,
      pulled: false
    };
  }
  let mongod: string;
  try {
    mongod = resolveBin("mongod");
  } catch {
    throw new Error(
      `MongoDB is not running on 127.0.0.1:${engine.hostPort} and \`mongod\` was not found. ` +
        `For a local (host) session, call install_project_infra (dependencyId=mongo) after user approval, or start mongod yourself, then call setup_project_infra again. ` +
        `Place the binary on PATH or in ~/.forge/runtime/bin/. Docker app-DB containers are only used for Cloud sessions.`
    );
  }
  const data = join(appDbHome(), "mongo", "data");
  mkdirSync(data, { recursive: true });
  const child = spawn(
    mongod,
    [
      "--dbpath",
      data,
      "--bind_ip",
      "127.0.0.1",
      "--port",
      String(engine.hostPort)
    ],
    { stdio: "ignore", detached: process.platform !== "win32" }
  );
  children.set(engine.id, child);
  await ensureHostMongoReady(engine);
  return {
    engineId: engine.id,
    containerName: `host:${engine.id}`,
    networkAlias: "127.0.0.1",
    reused: false,
    pulled: false
  };
}

export async function ensureHostEngineRunning(
  engine: AppDbEngine
): Promise<HostEnsureEngineResult> {
  if (engine.id === "postgres") return ensureHostPostgres(engine);
  return ensureHostMongo(engine);
}

export async function isHostEngineRunning(
  engine: AppDbEngine
): Promise<boolean> {
  return isTcpListening(engine.hostPort);
}

export async function waitForHostPostgresReady(
  engine: AppDbEngine,
  attempts = N_30
): Promise<void> {
  const pgIsReady = resolveBin("pg_isready");
  for (let i = 0; i < attempts; i++) {
    try {
      await execFileAsync(pgIsReady, [
        "-h",
        "127.0.0.1",
        "-p",
        String(engine.hostPort),
        "-U",
        engine.user
      ]);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, N_500));
    }
  }
  throw new Error(
    `Host Postgres on 127.0.0.1:${engine.hostPort} did not become ready`
  );
}

export async function ensureHostMongoReady(
  engine: AppDbEngine,
  attempts = N_30
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (await isTcpListening(engine.hostPort)) return;
    await new Promise((r) => setTimeout(r, N_500));
  }
  throw new Error(
    `Host Mongo on 127.0.0.1:${engine.hostPort} did not become ready`
  );
}

export async function createHostPostgresDatabase(options: {
  engine: AppDbEngine;
  database: string;
}): Promise<void> {
  const { engine, database } = options;
  await waitForHostPostgresReady(engine);
  const psql = resolveBin("psql");
  try {
    await execFileAsync(
      psql,
      [
        "-h",
        "127.0.0.1",
        "-p",
        String(engine.hostPort),
        "-U",
        engine.user,
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `CREATE DATABASE "${database}"`
      ],
      { maxBuffer: N_8 * N_1024 * N_1024, env: process.env }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists/i.test(msg)) throw err;
  }
}

export async function hostPostgresDatabaseExists(options: {
  engine: AppDbEngine;
  database: string;
}): Promise<boolean> {
  const { engine, database } = options;
  try {
    const psql = resolveBin("psql");
    const { stdout } = await execFileAsync(psql, [
      "-h",
      "127.0.0.1",
      "-p",
      String(engine.hostPort),
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

export async function dropHostPostgresDatabase(options: {
  engine: AppDbEngine;
  database: string;
}): Promise<void> {
  const { engine, database } = options;
  const psql = resolveBin("psql");
  await execFileAsync(psql, [
    "-h",
    "127.0.0.1",
    "-p",
    String(engine.hostPort),
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
