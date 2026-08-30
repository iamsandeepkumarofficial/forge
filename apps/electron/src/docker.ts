import { execFileSync } from "node:child_process";
import { POLL_MS, POSTGRES_ATTEMPTS } from "./types.js";
import { sleep } from "./httpWait.js";

export function runCapture(options: {
  cmd: string;
  args: readonly string[];
  cwd: string;
}): string {
  try {
    return execFileSync(options.cmd, [...options.args], {
      cwd: options.cwd,
      encoding: "utf8"
    }).trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${options.cmd} ${options.args.join(" ")} failed: ${message}`);
  }
}

export function preflightDocker(): string {
  try {
    runCapture({ cmd: "docker", args: ["info"], cwd: "." });
    return "Docker daemon is healthy";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Docker is missing or not running. Install Docker Desktop (or a compatible engine) and try again. (${message})`
    );
  }
}

export function composeUpInfra(root: string): void {
  runCapture({
    cmd: "docker",
    args: ["compose", "up", "-d", "postgres", "temporal"],
    cwd: root
  });
}

export function composeStop(root: string): void {
  try {
    runCapture({ cmd: "docker", args: ["compose", "stop"], cwd: root });
  } catch {
    return;
  }
}

export function sandboxImageExists(): boolean {
  try {
    runCapture({
      cmd: "docker",
      args: ["image", "inspect", "forge-sandbox:latest"],
      cwd: "."
    });
    return true;
  } catch {
    return false;
  }
}

export function ensureSandboxImage(root: string): void {
  if (sandboxImageExists()) return;
  process.stderr.write("[forge-electron] building forge-sandbox:latest …\n");
  runCapture({
    cmd: "docker",
    args: ["build", "-f", "Dockerfile.sandbox", "-t", "forge-sandbox:latest", "."],
    cwd: root
  });
}

export async function waitForPostgres(): Promise<void> {
  for (let i = 0; i < POSTGRES_ATTEMPTS; i += 1) {
    if (postgresReady()) return;
    await sleep(POLL_MS);
  }
}

function postgresReady(): boolean {
  try {
    runCapture({
      cmd: "docker",
      args: ["exec", "forge-postgres", "pg_isready", "-U", "postgres"],
      cwd: "."
    });
    return true;
  } catch {
    return false;
  }
}
