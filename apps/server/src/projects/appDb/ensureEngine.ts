import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type AppDbEngine, sandboxNetworkName } from "./engines.js";

const execFileAsync = promisify(execFile);
const N_30 = 30;
const N_32 = 32;
const N_500 = 500;
const N_1024 = 1024;

async function docker(
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("docker", args, {
    maxBuffer: N_32 * N_1024 * N_1024,
    env: process.env
  });
}

async function containerState(
  name: string
): Promise<"running" | "stopped" | "absent"> {
  try {
    const { stdout } = await docker([
      "inspect",
      "-f",
      "{{.State.Running}}",
      name
    ]);
    return stdout.trim() === "true" ? "running" : "stopped";
  } catch {
    return "absent";
  }
}

async function ensureNetwork(network: string): Promise<void> {
  try {
    await docker(["network", "inspect", network]);
  } catch {
    await docker(["network", "create", network]);
  }
}

async function ensureVolume(name: string): Promise<void> {
  try {
    await docker(["volume", "inspect", name]);
  } catch {
    await docker(["volume", "create", name]);
  }
}

async function ensureImage(image: string): Promise<"pulled" | "cached"> {
  try {
    await docker(["image", "inspect", image]);
    return "cached";
  } catch {
    await docker(["pull", image]);
    return "pulled";
  }
}

function startArgs(engine: AppDbEngine, network: string): string[] {
  const env =
    engine.id === "postgres"
      ? [
          "-e",
          `POSTGRES_USER=${engine.user}`,
          "-e",
          `POSTGRES_PASSWORD=${engine.password}`,
          "-e",
          "POSTGRES_DB=postgres"
        ]
      : [
          "-e",
          `MONGO_INITDB_ROOT_USERNAME=${engine.user}`,
          "-e",
          `MONGO_INITDB_ROOT_PASSWORD=${engine.password}`
        ];
  return [
    "run",
    "-d",
    "--name",
    engine.containerName,
    "--network",
    network,
    "--network-alias",
    engine.networkAlias,
    "-p",
    `${engine.hostPort}:${engine.containerPort}`,
    "-v",
    `${engine.volumeName}:${engine.id === "postgres" ? "/var/lib/postgresql/data" : "/data/db"}`,
    "--label",
    "forge.appdb=1",
    "--label",
    `forge.appdb.engine=${engine.id}`,
    "--label",
    `forge.appdb.image=${engine.image}`,
    ...env,
    engine.image
  ];
}

export type EnsureEngineResult = {
  engineId: string;
  containerName: string;
  networkAlias: string;
  reused: boolean;
  pulled: boolean;
};

export async function ensureEngineRunning(
  engine: AppDbEngine
): Promise<EnsureEngineResult> {
  const { resolveSandboxRuntimeKind } =
    await import("../sandboxRuntime/resolve.js");
  if (resolveSandboxRuntimeKind() === "host") {
    const { ensureHostEngineRunning } = await import("./hostAppDb.js");
    return ensureHostEngineRunning(engine);
  }
  const network = sandboxNetworkName();
  await ensureNetwork(network);

  const candidates = [engine.containerName, ...engine.legacyContainerNames];
  for (const name of candidates) {
    const state = await containerState(name);
    if (state === "running") {
      return {
        engineId: engine.id,
        containerName: name,
        networkAlias: engine.networkAlias,
        reused: true,
        pulled: false
      };
    }
    if (state === "stopped") {
      await docker(["start", name]);
      return {
        engineId: engine.id,
        containerName: name,
        networkAlias: engine.networkAlias,
        reused: true,
        pulled: false
      };
    }
  }

  const pull = await ensureImage(engine.image);
  await ensureVolume(engine.volumeName);
  await docker(startArgs(engine, network));
  return {
    engineId: engine.id,
    containerName: engine.containerName,
    networkAlias: engine.networkAlias,
    reused: false,
    pulled: pull === "pulled"
  };
}

export async function isEngineRunning(engine: AppDbEngine): Promise<boolean> {
  const { resolveSandboxRuntimeKind } =
    await import("../sandboxRuntime/resolve.js");
  if (resolveSandboxRuntimeKind() === "host") {
    const { isHostEngineRunning } = await import("./hostAppDb.js");
    return isHostEngineRunning(engine);
  }
  for (const name of [engine.containerName, ...engine.legacyContainerNames]) {
    if ((await containerState(name)) === "running") return true;
  }
  return false;
}

export async function resolveEngineContainer(
  engine: AppDbEngine
): Promise<string | null> {
  const { resolveSandboxRuntimeKind } =
    await import("../sandboxRuntime/resolve.js");
  if (resolveSandboxRuntimeKind() === "host") {
    const { isHostEngineRunning } = await import("./hostAppDb.js");
    return (await isHostEngineRunning(engine)) ? `host:${engine.id}` : null;
  }
  for (const name of [engine.containerName, ...engine.legacyContainerNames]) {
    const state = await containerState(name);
    if (state === "running" || state === "stopped") return name;
  }
  return null;
}

export async function waitForPostgresReady(options: {
  containerName: string;
  user: string;
  attempts?: number;
  engine?: AppDbEngine;
}): Promise<void> {
  const { resolveSandboxRuntimeKind } =
    await import("../sandboxRuntime/resolve.js");
  if (resolveSandboxRuntimeKind() === "host" && options.engine) {
    const { waitForHostPostgresReady } = await import("./hostAppDb.js");
    await waitForHostPostgresReady(options.engine, options.attempts);
    return;
  }
  const attempts = options.attempts ?? N_30;
  for (let i = 0; i < attempts; i++) {
    try {
      await docker([
        "exec",
        options.containerName,
        "pg_isready",
        "-U",
        options.user
      ]);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, N_500));
    }
  }
  throw new Error(`Postgres ${options.containerName} did not become ready`);
}
