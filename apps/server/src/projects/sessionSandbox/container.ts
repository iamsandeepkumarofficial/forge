import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUILD_MAX_BUFFER,
  DOCKER_MAX_BUFFER,
  FIRST_APP_PORT,
  GENERIC_SANDBOX_IMAGE,
  preferredSandboxImageName,
  RESERVED_PORTS,
  sandboxContainerName,
  sessionHostPortBase,
  sessionVolumeName,
  WORKSPACE_MOUNT
} from "./constants.js";
import type { BindMount, NamedVolumeMount } from "../sandboxRuntime/types.js";

const execFileAsync = promisify(execFile);
const N_20 = 20;
const N_250 = 250;

function sandboxDockerfilePath(image: string): string {
  const here = fileURLToPath(import.meta.url);
  const name =
    image === GENERIC_SANDBOX_IMAGE || image.includes("generic")
      ? "Dockerfile.sandbox-generic"
      : "Dockerfile.sandbox";
  return path.resolve(here, `../../../../${name}`);
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

export async function resolveSandboxImage(preferred?: string): Promise<string> {
  const configured = process.env.FORGE_SANDBOX_IMAGE?.trim();
  if (configured) {
    return configured;
  }
  const target = preferred?.trim() || preferredSandboxImageName();
  if (await imageExists(target)) {
    return target;
  }
  const dockerfile = sandboxDockerfilePath(target);
  try {
    await fs.access(dockerfile);
  } catch {
    throw new Error(
      `Sandbox image ${target} not found and ${dockerfile} is missing. ` +
        `Build with: pnpm docker:sandbox`
    );
  }
  await execFileAsync(
    "docker",
    ["build", "-f", dockerfile, "-t", target, repoRootForSandboxBuild()],
    { maxBuffer: BUILD_MAX_BUFFER }
  );
  return target;
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

async function bootstrapSandboxToolsRequired(
  containerName: string
): Promise<void> {
  await docker([
    "exec",
    containerName,
    "sh",
    "-c",
    "(command -v git >/dev/null 2>&1 || " +
      "(command -v apt-get >/dev/null 2>&1 && apt-get update && apt-get install -y --no-install-recommends git) || " +
      "apk add --no-cache git >/dev/null 2>&1 || true); " +
      "git config --global --replace-all safe.directory '*' >/dev/null 2>&1 || true"
  ]);
}

function bootstrapSandboxToolsOptional(containerName: string): void {
  void docker([
    "exec",
    containerName,
    "sh",
    "-c",
    "(command -v node >/dev/null 2>&1 && " +
      "(node -e \"require('playwright')\" >/dev/null 2>&1 || " +
      "(npm install -g playwright@1.49.1 && playwright install --with-deps chromium) || true) || true)"
  ]).catch((err) => {
    console.warn(
      `[sandbox] optional bootstrap failed for ${containerName}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  });
}

async function inspectContainer(name: string): Promise<{
  exists: boolean;
  isRunning: boolean;
  portBaseLabel: string;
  imageName: string;
  bindWorkspaceLabel: string;
  depsVolLabel: string;
}> {
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      "-f",
      '{{.State.Running}}|{{index .Config.Labels "forge.portbase"}}|{{.Config.Image}}|{{index .Config.Labels "forge.bindworkspace"}}|{{index .Config.Labels "forge.depsvol"}}',
      name
    ]);
    const [running, label, image, bindWs, depsVol] = stdout.trim().split("|");
    return {
      exists: true,
      isRunning: running === "true",
      portBaseLabel: label ?? "",
      imageName: image ?? "",
      bindWorkspaceLabel: bindWs ?? "",
      depsVolLabel: depsVol ?? ""
    };
  } catch {
    return {
      exists: false,
      isRunning: false,
      portBaseLabel: "",
      imageName: "",
      bindWorkspaceLabel: "",
      depsVolLabel: ""
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

function namedVolumeArgs(vols: NamedVolumeMount[] | undefined): string[] {
  if (!vols?.length) return [];
  const args: string[] = [];
  for (const v of vols) {
    args.push("-v", `${v.volumeName}:${v.containerPath}`);
  }
  return args;
}

function depsVolLabelValue(vols: NamedVolumeMount[] | undefined): string {
  return (
    vols
      ?.map((v) => v.volumeName)
      .sort()
      .join(",") ?? ""
  );
}

async function createSandboxContainer(options: {
  sessionId: string;
  name: string;
  volumeName: string;
  portBase: number;
  bindMounts?: BindMount[];
  namedVolumes?: NamedVolumeMount[];
  containerEnv?: Record<string, string>;
  image?: string;
}): Promise<void> {
  const sandboxImage = await resolveSandboxImage(options.image);
  const portArgs: string[] = [];
  for (let i = 0; i < RESERVED_PORTS; i++) {
    portArgs.push("-p", `${options.portBase + i}:${FIRST_APP_PORT + i}`);
  }
  const wsHost = workspaceBindHost(options.bindMounts);
  const volumeArgs = wsHost
    ? []
    : (["-v", `${options.volumeName}:${WORKSPACE_MOUNT}`] as string[]);
  const extraBinds = bindMountArgs(options.bindMounts);
  const extraNamed = namedVolumeArgs(options.namedVolumes);
  const labels: string[] = [
    "forge.sandbox=1",
    `forge.session=${options.sessionId}`,
    `forge.portbase=${options.portBase}`
  ];
  if (wsHost) {
    labels.push(`forge.bindworkspace=${wsHost}`);
  }
  const depsVol = depsVolLabelValue(options.namedVolumes);
  if (depsVol) {
    labels.push(`forge.depsvol=${depsVol}`);
  }
  const labelArgs = labels.flatMap((l) => ["--label", l]);
  const network = process.env.FORGE_SANDBOX_NETWORK?.trim() || "forge";
  const envArgs: string[] = [
    "-e",
    "NODE_PATH=/usr/local/lib/node_modules",
    "-e",
    `HOST=0.0.0.0`,
    "-e",
    `FORGE_PUBLISHED_APP_PORTS=${FIRST_APP_PORT}-${FIRST_APP_PORT + RESERVED_PORTS - 1}`
  ];
  for (const [k, v] of Object.entries(options.containerEnv ?? {})) {
    envArgs.push("-e", `${k}=${v}`);
  }
  await docker([
    "run",
    "-d",
    "--init",
    "--name",
    options.name,
    "--network",
    network,
    ...labelArgs,
    ...envArgs,
    ...portArgs,
    ...volumeArgs,
    ...extraBinds,
    ...extraNamed,
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
  namedVolumes?: NamedVolumeMount[];
  containerEnv?: Record<string, string>;
  image?: string;
};

export async function ensureContainer(
  options: {
    sessionId: string;
    volumeName: string;
  } & EnsureContainerOpts
): Promise<string> {
  const { sessionId, volumeName } = options;
  const opts = options;
  const name = sandboxContainerName(sessionId);
  const portBase = sessionHostPortBase(sessionId);
  const preferredImage = opts.image?.trim() || preferredSandboxImageName();
  const desiredBind = workspaceBindHost(opts.bindMounts) ?? "";
  const desiredDeps = depsVolLabelValue(opts.namedVolumes);
  let state = await inspectContainer(name);
  const wrongPorts = state.exists && state.portBaseLabel !== String(portBase);
  const wrongImage =
    state.exists &&
    state.imageName !== "" &&
    state.imageName !== preferredImage;
  const wrongBind =
    state.exists && (state.bindWorkspaceLabel || "") !== desiredBind;
  const wrongDeps = state.exists && (state.depsVolLabel || "") !== desiredDeps;
  if (wrongPorts || wrongImage || wrongBind || wrongDeps) {
    await execFileAsync("docker", ["rm", "-f", name]).catch(() => {});
    state = {
      exists: false,
      isRunning: false,
      portBaseLabel: "",
      imageName: "",
      bindWorkspaceLabel: "",
      depsVolLabel: ""
    };
  }
  let needsBootstrap = false;
  if (!state.exists) {
    await createSandboxContainer({
      sessionId,
      name,
      volumeName,
      portBase,
      bindMounts: opts?.bindMounts,
      namedVolumes: opts?.namedVolumes,
      containerEnv: opts?.containerEnv,
      image: preferredImage
    });
    needsBootstrap = true;
  } else if (!state.isRunning) {
    await docker(["start", name]);
    needsBootstrap = true;
  }
  if (needsBootstrap) {
    await bootstrapSandboxToolsRequired(name);
    bootstrapSandboxToolsOptional(name);
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

export async function repairHostPortBindings(options: {
  containerName: string;
  portBase: number;
}): Promise<boolean> {
  const { isHostTcpListening, isTcpListening } =
    await import("../backgroundJob.js");
  const missing = await publishedHostPortsNeedingRepair({
    containerName: options.containerName,
    portBase: options.portBase,
    isHostOpen: isHostTcpListening,
    isContainerOpen: (port) =>
      isTcpListening({ containerName: options.containerName, port })
  });
  if (missing.length === 0) return false;
  console.warn(
    `[sandbox] host ports missing for ${options.containerName}: ${missing.join(", ")}; restarting container to rebind`
  );
  await docker(["restart", options.containerName]);

  for (let i = 0; i < N_20; i += 1) {
    const stillMissing = await publishedHostPortsNeedingRepair({
      containerName: options.containerName,
      portBase: options.portBase,
      isHostOpen: isHostTcpListening,
      isContainerOpen: (port) =>
        isTcpListening({ containerName: options.containerName, port })
    });
    if (stillMissing.length === 0) return true;
    await new Promise((r) => setTimeout(r, N_250));
  }
  return true;
}

export async function publishedHostPortsNeedingRepair(options: {
  containerName: string;
  portBase: number;
  isHostOpen: (port: number) => Promise<boolean>;
  isContainerOpen: (port: number) => Promise<boolean>;
}): Promise<number[]> {
  const needed: number[] = [];
  for (let i = 0; i < RESERVED_PORTS; i++) {
    const containerPort = FIRST_APP_PORT + i;
    if (await options.isContainerOpen(containerPort)) {
      needed.push(options.portBase + i);
    }
  }
  if (needed.length === 0) return [];
  const flags = await Promise.all(needed.map((p) => options.isHostOpen(p)));
  return needed.filter((_, i) => !flags[i]);
}
