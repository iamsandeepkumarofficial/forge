import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveSandboxRuntimeKind } from "../../../projects/sandboxRuntime/resolve.js";

const N_12000 = 12000;

const N_1024 = 1024;
const N_8 = 8;
const N_1500000 = 1500000;

const execFileAsync = promisify(execFile);
const IMAGE = process.env.WEB_SEARCH_WORKER_IMAGE?.trim() || "node:20-alpine";
export type WorkerState = "warming" | "ready" | "busy" | "draining" | "stopped";
export type WebSearchWorker = {
  id: string;
  containerName: string;
  state: WorkerState;
  startedAt: number;
};
async function docker(args: string[]): Promise<{
  stdout: string;
  stderr: string;
}> {
  try {
    return await execFileAsync("docker", args, {
      maxBuffer: N_8 * N_1024 * N_1024,
      env: process.env
    });
  } catch (err) {
    const e = err as {
      stderr?: string;
      message?: string;
    };
    throw new Error(
      e.stderr?.trim() || e.message || `docker ${args[0]} failed`,
      {
        cause: err
      }
    );
  }
}
async function containerRunning(name: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["inspect", "-f", "{{.State.Running}}", name],
      { env: process.env }
    );
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}
export function workerContainerName(index: number): string {
  return `forge-websearch-${index}`;
}

function hostWorkerName(index: number): string {
  return `host-websearch-${index}`;
}

export async function ensureWorker(index: number): Promise<WebSearchWorker> {
  const id = `websearch-${index}`;
  const startedAt = Date.now();
  if (resolveSandboxRuntimeKind() === "host") {
    return {
      id,
      containerName: hostWorkerName(index),
      state: "ready",
      startedAt
    };
  }
  const containerName = workerContainerName(index);
  if (await containerRunning(containerName)) {
    return { id, containerName, state: "ready", startedAt };
  }
  try {
    await execFileAsync("docker", ["rm", "-f", containerName], {
      env: process.env
    });
  } catch {
    void 0;
  }
  await docker([
    "run",
    "-d",
    "--name",
    containerName,
    "--label",
    "forge.role=websearch",
    IMAGE,
    "sleep",
    "infinity"
  ]);
  return { id, containerName, state: "ready", startedAt };
}
export async function stopWorker(index: number): Promise<void> {
  if (resolveSandboxRuntimeKind() === "host") {
    return;
  }
  const name = workerContainerName(index);
  try {
    await execFileAsync("docker", ["rm", "-f", name], { env: process.env });
  } catch {
    void 0;
  }
}

async function fetchHtmlOnHost(options: {
  url: string;
  timeoutMs: number;
}): Promise<string> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), options.timeoutMs);
  try {
    const r = await fetch(options.url, {
      signal: ac.signal,
      headers: {
        "User-Agent": "ForgeAgentWebSearch/1.0",
        Accept: "text/html"
      },
      redirect: "follow"
    });
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}`);
    }
    const text = await r.text();
    return text.slice(0, N_1500000);
  } finally {
    clearTimeout(t);
  }
}

export async function fetchHtmlInWorker(options: {
  containerName: string;
  url: string;
  timeoutMs?: number;
}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? N_12000;
  if (
    resolveSandboxRuntimeKind() === "host" ||
    options.containerName.startsWith("host-websearch-")
  ) {
    return fetchHtmlOnHost({ url: options.url, timeoutMs });
  }
  const script = `
const u = process.argv[1];
const ac = new AbortController();
const t = setTimeout(() => ac.abort(), ${timeoutMs});
fetch(u, { signal: ac.signal, headers: { "User-Agent": "ForgeAgentWebSearch/1.0", Accept: "text/html" }, redirect: "follow" })
  .then(async (r) => {
    if (!r.ok) { console.error("HTTP " + r.status); process.exit(2); }
    const text = await r.text();
    process.stdout.write(text.slice(0, 1500000));
  })
  .catch((e) => { console.error(String(e)); process.exit(1); })
  .finally(() => clearTimeout(t));
`;
  const { stdout } = await docker([
    "exec",
    options.containerName,
    "node",
    "-e",
    script,
    options.url
  ]);
  return stdout;
}
