import { execFileSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultHome } from "./config.js";
import {
  forgeHome,
  NATIVE_DATABASE_URL,
  NATIVE_PG_PORT,
  NATIVE_TEMPORAL_PORT,
  NATIVE_TEMPORAL_UI_PORT
} from "./hostMode.js";
import { spawnLogged, killProcessTree } from "./processTree.js";
import { POSTGRES_ATTEMPTS } from "./types.js";
import { isTcpOpen, waitForTcp } from "./tcpWait.js";

export type NativeStackHandle = {
  children: ChildProcess[];
  stop: () => void;
};

export type NativeStackDeps = {
  home?: string;
  which?: (cmd: string) => string | null;
  spawn?: typeof spawnLogged;
  run?: (options: {
    cmd: string;
    args: readonly string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }) => void;
  waitTcp?: typeof waitForTcp;
  isOpen?: typeof isTcpOpen;
};

type Paths = {
  home: string;
  pgData: string;
  pgRun: string;
  pgLog: string;
  temporalDir: string;
  temporalDb: string;
  runtimeBin: string;
};

function pathsFor(home: string): Paths {
  const forge = join(home, ".forge");
  return {
    home,
    pgData: join(forge, "pg", "data"),
    pgRun: join(forge, "pg", "run"),
    pgLog: join(forge, "pg", "postgres.log"),
    temporalDir: join(forge, "temporal"),
    temporalDb: join(forge, "temporal", "temporal.db"),
    runtimeBin: join(forge, "runtime", "bin")
  };
}

export function resolveNativeBin(
  name: string,
  options: { runtimeBin: string; which: (cmd: string) => string | null }
): string {
  const local = join(options.runtimeBin, name);
  if (existsSync(local)) return local;
  const brew = [
    `/opt/homebrew/opt/postgresql@16/bin/${name}`,
    `/usr/local/opt/postgresql@16/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`
  ];
  for (const candidate of brew) {
    if (existsSync(candidate)) return candidate;
  }
  const fromPath = options.which(name);
  if (fromPath) return fromPath;
  throw new Error(
    `Missing \`${name}\` for host-mode desktop. Install PostgreSQL 16 and the Temporal CLI, or place binaries in ~/.forge/runtime/bin/.`
  );
}

export function defaultWhich(cmd: string): string | null {
  try {
    const out = execFileSync(
      process.platform === "win32" ? "where" : "which",
      [cmd],
      { encoding: "utf8" }
    );
    const line = out.trim().split(/\r?\n/)[0]?.trim();
    return line || null;
  } catch {
    return null;
  }
}

function defaultRun(options: {
  cmd: string;
  args: readonly string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): void {
  execFileSync(options.cmd, [...options.args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: "pipe"
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

function initPostgresCluster(options: {
  paths: Paths;
  initdb: string;
  run: NonNullable<NativeStackDeps["run"]>;
}): void {
  const { paths, initdb, run } = options;
  if (existsSync(join(paths.pgData, "PG_VERSION"))) return;
  mkdirSync(paths.pgData, { recursive: true });
  run({
    cmd: initdb,
    args: [
      "-D",
      paths.pgData,
      "-U",
      "postgres",
      "--auth-local=trust",
      "--auth-host=trust"
    ]
  });
  writeFileSync(join(paths.pgData, "pg_hba.conf"), pgHbaTrust());
}

async function ensurePostgres(options: {
  paths: Paths;
  which: (cmd: string) => string | null;
  run: NativeStackDeps["run"];
  spawn: typeof spawnLogged;
  waitTcp: typeof waitForTcp;
  isOpen: typeof isTcpOpen;
  children: ChildProcess[];
}): Promise<void> {
  const { paths, which, run, spawn, waitTcp, isOpen, children } = options;
  if (await isOpen({ host: "127.0.0.1", port: NATIVE_PG_PORT })) return;

  const initdb = resolveNativeBin("initdb", {
    runtimeBin: paths.runtimeBin,
    which
  });
  const postgres = resolveNativeBin("postgres", {
    runtimeBin: paths.runtimeBin,
    which
  });
  mkdirSync(paths.pgRun, { recursive: true });
  initPostgresCluster({ paths, initdb, run: run! });
  const child = spawn({
    cmd: postgres,
    args: [
      "-D",
      paths.pgData,
      "-p",
      String(NATIVE_PG_PORT),
      "-h",
      "127.0.0.1",
      "-k",
      paths.pgRun,
      "-c",
      `logging_collector=off`,
      "-c",
      `log_destination=stderr`
    ],
    cwd: paths.home,
    env: {},
    label: "postgres"
  });
  children.push(child);
  await waitTcp({
    host: "127.0.0.1",
    port: NATIVE_PG_PORT,
    attempts: POSTGRES_ATTEMPTS,
    label: "postgres"
  });
  try {
    const createdb = resolveNativeBin("createdb", {
      runtimeBin: paths.runtimeBin,
      which
    });
    run!({
      cmd: createdb,
      args: [
        "-h",
        "127.0.0.1",
        "-p",
        String(NATIVE_PG_PORT),
        "-U",
        "postgres",
        "forge"
      ]
    });
  } catch {
    void 0;
  }
}

async function ensureTemporal(options: {
  paths: Paths;
  which: (cmd: string) => string | null;
  spawn: typeof spawnLogged;
  waitTcp: typeof waitForTcp;
  isOpen: typeof isTcpOpen;
  children: ChildProcess[];
}): Promise<void> {
  const { paths, which, spawn, waitTcp, isOpen, children } = options;
  if (await isOpen({ host: "127.0.0.1", port: NATIVE_TEMPORAL_PORT })) {
    return;
  }

  const temporal = resolveNativeBin("temporal", {
    runtimeBin: paths.runtimeBin,
    which
  });
  mkdirSync(paths.temporalDir, { recursive: true });
  const child = spawn({
    cmd: temporal,
    args: [
      "server",
      "start-dev",
      "--ip",
      "127.0.0.1",
      "--port",
      String(NATIVE_TEMPORAL_PORT),
      "--ui-port",
      String(NATIVE_TEMPORAL_UI_PORT),
      "--db-filename",
      paths.temporalDb
    ],
    cwd: paths.home,
    env: {},
    label: "temporal"
  });
  children.push(child);
  await waitTcp({
    host: "127.0.0.1",
    port: NATIVE_TEMPORAL_PORT,
    attempts: POSTGRES_ATTEMPTS,
    label: "temporal"
  });
}

function runMigrations(options: {
  root: string;
  run: NonNullable<NativeStackDeps["run"]>;
}): void {
  options.run({
    cmd: "pnpm",
    args: ["--filter", "@forge/db", "db:migrate"],
    cwd: options.root,
    env: { DATABASE_URL: NATIVE_DATABASE_URL }
  });
}

export async function ensureNativeStack(
  root: string,
  deps: NativeStackDeps = {}
): Promise<NativeStackHandle> {
  const home = deps.home ?? defaultHome(process.env) ?? forgeHome();
  const paths = pathsFor(home);
  const which = deps.which ?? defaultWhich;
  const spawn = deps.spawn ?? spawnLogged;
  const run = deps.run ?? defaultRun;
  const waitTcp = deps.waitTcp ?? waitForTcp;
  const isOpen = deps.isOpen ?? isTcpOpen;
  const children: ChildProcess[] = [];

  mkdirSync(paths.runtimeBin, { recursive: true });
  await ensurePostgres({ paths, which, run, spawn, waitTcp, isOpen, children });
  runMigrations({ root, run });
  await ensureTemporal({ paths, which, spawn, waitTcp, isOpen, children });

  return {
    children,
    stop: () => {
      for (const child of children) {
        if (child.pid) killProcessTree(child.pid);
      }
      try {
        const pgCtl = resolveNativeBin("pg_ctl", {
          runtimeBin: paths.runtimeBin,
          which
        });
        run({
          cmd: pgCtl,
          args: ["-D", paths.pgData, "stop", "-m", "fast"]
        });
      } catch {
        void 0;
      }
    }
  };
}
