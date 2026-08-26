import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUILD_MAX_BUFFER,
  DEFAULT_SANDBOX_IMAGE,
  DOCKER_MAX_BUFFER,
  FIRST_APP_PORT,
  preferredSandboxImageName,
  RESERVED_PORTS,
  sandboxContainerName,
  sessionHostPortBase,
  sessionVolumeName,
  WORKSPACE_MOUNT
} from "./constants.js";
import type { BindMount } from "../sandboxRuntime/types.js";

const execFileAsync = promisify(execFile);

function sandboxDockerfilePath(): string {
  const here = fileURLToPath(import.meta.url);
  return path.resolve(here, "../../../../Dockerfile.sandbox");
}

function repoRootForSandboxBuild(): string {
  const here = fileURLToPath(import.meta.url);
  return path.resolve(here, "../../../..");
}

async function imageExists(image: string): Promise<boolean> {
  try {
    await execFileAsync("docker", ["image", "inspect", image]);
    return true;
  } catch {
    return false;
  }
}

export async function resolveSandboxImage(): Promise<string> {
  const configured = process.env.FORGE_SANDBOX_IMAGE?.trim();
  if (configured) {
    return configured;
  }
  const preferred = DEFAULT_SANDBOX_IMAGE;
  if (await imageExists(preferred)) {
    return preferred;
  }
  const dockerfile = sandboxDockerfilePath();
  try {
    await fs.access(dockerfile);
  } catch {
    throw new Error(
      `Sandbox image ${preferred} not found and ${dockerfile} is missing. ` +
        `Build with: docker build -f Dockerfile.sandbox -t ${preferred} .`
    );
  }
  await execFileAsync(
    "docker",
    ["build", "-f", dockerfile, "-t", preferred, repoRootForSandboxBuild()],
    { maxBuffer: BUILD_MAX_BUFFER }
  );
  return preferred;
}

export async function docker(args: string[]): Promise<{
  stdout: string;
  stderr: string;
}> {
  try {
    return await execFileAsync("docker", args, {
      maxBuffer: DOCKER_MAX_BUFFER,
      env: process.env
    });
  } catch (err: unknown) {
    const e = err as {
      stderr?: string;
      stdout?: string;
      message?: string;
    };
    const detail = (e.stderr || e.stdout || e.message || "").toString().trim();
    throw new Error(detail || `docker ${args[0]} failed`, { cause: err });
  }
}

export async function ensureVolume(sessionId: string): Promise<string> {
  const name = sessionVolumeName(sessionId);
  try {
    await execFileAsync("docker", ["volume", "inspect", name]);
  } catch {
    await docker(["volume", "create", name]);
  }
  return name;
}

async function bootstrapSandboxTools(containerName: string): Promise<void> {
  await docker([
    "exec",
    containerName,
    "sh",
    "-c",
    "(command -v git >/dev/null 2>&1 || " +
      "(command -v apt-get >/dev/null 2>&1 && apt-get update && apt-get install -y --no-install-recommends git) || " +
      "apk add --no-cache git >/dev/null 2>&1 || true); " +
      "(node -e \"require('playwright')\" >/dev/null 2>&1 || " +
      "(npm install -g playwright@1.49.1 && playwright install --with-deps chromium) || true); " +
      "git config --global --replace-all safe.directory '*' >/dev/null 2>&1 || true"
  ]);
}

async function inspectContainer(name: string): Promise<{
  exists: boolean;
  isRunning: boolean;
  portBaseLabel: string;
  imageName: string;
  bindWorkspaceLabel: string;
}> {
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      "-f",
      '{{.State.Running}}|{{index .Config.Labels "forge.portbase"}}|{{.Config.Image}}|{{index .Config.Labels "forge.bindworkspace"}}',
      name
    ]);
    const [running, label, image, bindWs] = stdout.trim().split("|");
    return {
      exists: true,
      isRunning: running === "true",
      portBaseLabel: label ?? "",
      imageName: image ?? "",
      bindWorkspaceLabel: bindWs ?? ""
    };
  } catch {
    return {
      exists: false,
      isRunning: false,
      portBaseLabel: "",
      imageName: "",
      bindWorkspaceLabel: ""
    };
  }
}

function bindMountArgs(bindMounts: BindMount[] | undefined): string[] {
  if (!bindMounts?.length) return [];
  const args: string[] = [];
  for (const m of bindMounts) {
    const suffix = m.readOnly ? ":ro" : "";
    args.push("-v", `${m.hostPath}:${m.containerPath}${suffix}`);
  }
  return args;
}

function workspaceBindHost(
  bindMounts: BindMount[] | undefined
): string | undefined {
  return bindMounts?.find((m) => m.containerPath === WORKSPACE_MOUNT)?.hostPath;
}

async function createSandboxContainer(options: {
  sessionId: string;
  name: string;
  volumeName: string;
  portBase: number;
  bindMounts?: BindMount[];
}): Promise<void> {
  const sandboxImage = await resolveSandboxImage();
  const portArgs: string[] = [];
  for (let i = 0; i < RESERVED_PORTS; i++) {
    portArgs.push("-p", `${options.portBase + i}:${FIRST_APP_PORT + i}`);
  }
  const wsHost = workspaceBindHost(options.bindMounts);
  const volumeArgs = wsHost
    ? []
    : (["-v", `${options.volumeName}:${WORKSPACE_MOUNT}`] as string[]);
  const extraBinds = bindMountArgs(options.bindMounts);
  const labels: string[] = [
    "forge.sandbox=1",
    `forge.session=${options.sessionId}`,
    `forge.portbase=${options.portBase}`
  ];
  if (wsHost) {
    labels.push(`forge.bindworkspace=${wsHost}`);
  }
  const labelArgs = labels.flatMap((l) => ["--label", l]);
  await docker([
    "run",
    "-d",
    "--init",
    "--name",
    options.name,
    ...labelArgs,
    "-e",
    "NODE_PATH=/usr/local/lib/node_modules",
    ...portArgs,
    ...volumeArgs,
    ...extraBinds,
    "-w",
    WORKSPACE_MOUNT,
    sandboxImage,
    "sh",
    "-c",
    "exec sleep infinity"
  ]);
}

export type EnsureContainerOpts = {
  bindMounts?: BindMount[];
};

export async function ensureContainer(
  sessionId: string,
  volumeName: string,
  opts?: EnsureContainerOpts
): Promise<string> {
  const name = sandboxContainerName(sessionId);
  const portBase = sessionHostPortBase(sessionId);
  const preferredImage = preferredSandboxImageName();
  const desiredBind = workspaceBindHost(opts?.bindMounts) ?? "";
  let state = await inspectContainer(name);
  const wrongPorts = state.exists && state.portBaseLabel !== String(portBase);
  const wrongImage =
    state.exists &&
    state.imageName !== "" &&
    state.imageName !== preferredImage;
  const wrongBind =
    state.exists && (state.bindWorkspaceLabel || "") !== desiredBind;
  if (wrongPorts || wrongImage || wrongBind) {
    await execFileAsync("docker", ["rm", "-f", name]).catch(() => {});
    state = {
      exists: false,
      isRunning: false,
      portBaseLabel: "",
      imageName: "",
      bindWorkspaceLabel: ""
    };
  }
  let needsBootstrap = false;
  if (!state.exists) {
    await createSandboxContainer({
      sessionId,
      name,
      volumeName,
      portBase,
      bindMounts: opts?.bindMounts
    });
    needsBootstrap = true;
  } else if (!state.isRunning) {
    await docker(["start", name]);
    needsBootstrap = true;
  }
  if (needsBootstrap) {
    await bootstrapSandboxTools(name);
  }
  await repairHostPortBindings({ containerName: name, portBase });
  const { stdout } = await execFileAsync("docker", [
    "inspect",
    "-f",
    "{{.Id}}",
    name
  ]);
  return stdout.trim();
}

/**
 * Docker Desktop (esp. gVisor) can drop published host ports while the
 * container keeps running. Restart once if the reserved preview ports are gone.
 */
export async function repairHostPortBindings(options: {
  containerName: string;
  portBase: number;
}): Promise<boolean> {
  const { isHostTcpListening } = await import("../backgroundJob.js");
  const missing = await missingHostPorts(options.portBase, isHostTcpListening);
  if (missing.length === 0) return false;
  console.warn(
    `[sandbox] host ports missing for ${options.containerName}: ${missing.join(", ")}; restarting container to rebind`
  );
  await docker(["restart", options.containerName]);
  // Give Docker Desktop a moment to re-attach port proxies.
  for (let i = 0; i < 20; i += 1) {
    const stillMissing = await missingHostPorts(
      options.portBase,
      isHostTcpListening
    );
    if (stillMissing.length === 0) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return true;
}

async function missingHostPorts(
  portBase: number,
  isOpen: (port: number) => Promise<boolean>
): Promise<number[]> {
  const ports = Array.from({ length: RESERVED_PORTS }, (_, i) => portBase + i);
  const flags = await Promise.all(ports.map((p) => isOpen(p)));
  return ports.filter((_, i) => !flags[i]);
}
