import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  type AppDbEngine,
  sandboxNetworkName
} from "./engines.js";

const execFileAsync = promisify(execFile);

async function docker(
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("docker", args, {
    maxBuffer: 32 * 1024 * 1024,
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
  for (const name of [engine.containerName, ...engine.legacyContainerNames]) {
    if ((await containerState(name)) === "running") return true;
  }
  return false;
}

export async function resolveEngineContainer(
  engine: AppDbEngine
): Promise<string | null> {
  for (const name of [engine.containerName, ...engine.legacyContainerNames]) {
    const state = await containerState(name);
    if (state === "running" || state === "stopped") return name;
  }
  return null;
}

export async function waitForPostgresReady(
  containerName: string,
  user: string,
  attempts = 30
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await docker([
        "exec",
        containerName,
        "pg_isready",
        "-U",
        user
      ]);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Postgres ${containerName} did not become ready`);
}
