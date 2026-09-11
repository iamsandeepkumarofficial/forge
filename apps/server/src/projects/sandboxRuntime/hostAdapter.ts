import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { revokePreviewSession } from "../../preview/previewPlaneClient.js";
import { WORKSPACE_MOUNT } from "../sessionSandbox/constants.js";
import {
  ensureSessionsRoot,
  resolveSessionsRoot
} from "../../services/project/projectsRoot.js";
import {
  hostPublishedAppPortsEnv,
  isHostRegistryPort,
  releaseSessionPorts
} from "./sessionPortRegistry.js";
import { hostPreviewHostname } from "./previewHostname.js";
import { resolveWrappedArgv } from "./osSandbox.js";
import { hostProcessEnv } from "./hostEnv.js";
import {
  hostManagedSessionRoot,
  isUnderHostManagedRoot,
  sanitizeSessionFsName
} from "./hostSessionPaths.js";
import {
  ensureHostWorkspaceRoot,
  normalizeContainerPath,
  workspaceMountsFromBinds,
  type WorkspaceMount
} from "./hostWorkspaceView.js";
import {
  hostEnsurePublishedPortReady,
  hostPublishPreviewPort,
  hostResolveListenPort
} from "./hostAdapterPorts.js";
import type {
  CreateOpts,
  ExecOpts,
  ExecResult,
  RuntimeExecInput,
  SandboxRuntime,
  SessionRuntimeStatus,
  WorkspaceHandle
} from "./types.js";
import { SandboxRuntimeError } from "./types.js";

export {
  ensureHostWorkspaceRoot,
  workspaceMountsFromBinds,
  type WorkspaceMount
} from "./hostWorkspaceView.js";

const N_16 = 16;
const N_1024 = 1024;
const DEFAULT_MAX_BUFFER = N_16 * N_1024 * N_1024;

type HostSessionState = {
  root: string;
  mounts: WorkspaceMount[];
  extraWritableRoots: string[];
};

const sessionStates = new Map<string, HostSessionState>();

export function hostSessionRuntimeDir(sessionId: string): string {
  return path.join(hostManagedSessionRoot(sessionId), ".forge-runtime");
}

export function mapHostLogicalPath(
  logical: string,
  options: { root: string; mounts: WorkspaceMount[] }
): string {
  const raw = logical.replace(/\\/g, "/");
  if (raw !== WORKSPACE_MOUNT && !raw.startsWith(`${WORKSPACE_MOUNT}/`)) {
    return logical;
  }
  const normalized = normalizeContainerPath(raw);
  for (const mount of options.mounts) {
    if (
      normalized === mount.containerPath ||
      normalized.startsWith(`${mount.containerPath}/`)
    ) {
      const rest = normalized
        .slice(mount.containerPath.length)
        .replace(/^\//, "");
      return rest ? path.join(mount.hostPath, rest) : mount.hostPath;
    }
  }
  const rest = normalized.slice(WORKSPACE_MOUNT.length).replace(/^\//, "");
  return rest ? path.join(options.root, rest) : options.root;
}

function mapEnvPaths(
  env: NodeJS.ProcessEnv,
  options: { root: string; mounts: WorkspaceMount[] }
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env };
  for (const key of Object.keys(out)) {
    const v = out[key];
    if (typeof v === "string") {
      out[key] = mapHostLogicalPath(v, options);
    }
  }
  return out;
}

function mountHostPaths(mounts: WorkspaceMount[]): string[] {
  return [...new Set(mounts.map((m) => m.hostPath))];
}

const WORKTREES_MARKER = `${path.sep}worktrees${path.sep}`;

export async function gitdirWritableRoots(workDir: string): Promise<string[]> {
  const pointer = path.join(workDir, ".git");
  try {
    const st = await fs.stat(pointer);
    if (st.isDirectory()) return [pointer];
    if (!st.isFile()) return [];
    const contents = await fs.readFile(pointer, "utf8");
    const match = contents.match(/^\s*gitdir:\s*(.+)\s*$/m);
    if (!match?.[1]) return [];
    const gitdir = path.resolve(match[1].trim());
    const idx = gitdir.lastIndexOf(WORKTREES_MARKER);
    const common = idx > 0 ? gitdir.slice(0, idx) : gitdir;
    return [...new Set([gitdir, common])];
  } catch {
    return [];
  }
}

async function extraWritableRootsForMounts(
  mounts: WorkspaceMount[]
): Promise<string[]> {
  const roots = [...mountHostPaths(mounts)];
  for (const mount of mounts) {
    roots.push(...(await gitdirWritableRoots(mount.hostPath)));
  }
  return [...new Set(roots)];
}

export function extraWritableRootsForHostRoot(root: string): string[] {
  for (const state of sessionStates.values()) {
    if (state.root === root) return state.extraWritableRoots;
  }
  return [];
}

function missingCwdResult(options: {
  cwd: string;
  logicalCwd?: string;
  root: string;
  mounts: WorkspaceMount[];
}): ExecResult {
  const logicalHint =
    options.logicalCwd && options.logicalCwd !== options.cwd
      ? ` (logical: ${options.logicalCwd})`
      : "";
  const members = options.mounts
    .filter((m) => m.containerPath !== WORKSPACE_MOUNT)
    .map((m) => m.containerPath.slice(WORKSPACE_MOUNT.length + 1))
    .filter(Boolean);
  const memberHint =
    members.length > 0
      ? ` Known member repos: ${members.sort().join(", ")}.`
      : "";
  return {
    code: 1,
    stdout: "",
    stderr:
      `Working directory does not exist: ${options.cwd}${logicalHint}. ` +
      `Host session root: ${options.root}.${memberHint}`
  };
}

async function spawnHostProcess(options: {
  wrappedArgv: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  opts: ExecOpts;
  maxBuffer: number;
}): Promise<ExecResult> {
  const { wrappedArgv, cwd, env, opts, maxBuffer } = options;
  return new Promise<ExecResult>((resolve, reject) => {
    const child = spawn(wrappedArgv[0]!, wrappedArgv.slice(1), {
      cwd,
      env,
      detached: Boolean(opts.detach),
      stdio: opts.detach ? "ignore" : ["pipe", "pipe", "pipe"]
    });
    if (opts.detach) {
      child.unref();
      const pid = child.pid;
      resolve({
        code: 0,
        stdout: "",
        stderr: "",
        ...(typeof pid === "number" && pid > 0 ? { pid } : {})
      });
      return;
    }
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let outLen = 0;
    let errLen = 0;
    child.stdout?.on("data", (c: Buffer) => {
      if (outLen < maxBuffer) {
        outChunks.push(c);
        outLen += c.length;
      }
    });
    child.stderr?.on("data", (c: Buffer) => {
      if (errLen < maxBuffer) {
        errChunks.push(c);
        errLen += c.length;
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? 0,
        stdout: Buffer.concat(outChunks).toString("utf8"),
        stderr: Buffer.concat(errChunks).toString("utf8")
      });
    });
    if (opts.input !== undefined) {
      child.stdin?.end(opts.input);
    } else {
      child.stdin?.end();
    }
  });
}

async function hostExec(input: {
  root: string;
  mounts: WorkspaceMount[];
  argv: string[];
  opts: ExecOpts;
}): Promise<ExecResult> {
  const { root, mounts, opts } = input;
  const mapOpts = { root, mounts };
  const argv = input.argv.map((a) => mapHostLogicalPath(a, mapOpts));
  const logicalCwd = opts.cwd;
  const cwd = logicalCwd ? mapHostLogicalPath(logicalCwd, mapOpts) : root;
  try {
    await fs.access(cwd);
  } catch {
    return missingCwdResult({ cwd, logicalCwd, root, mounts });
  }
  const wrappedArgv = await resolveWrappedArgv({
    argv,
    sessionRoot: root,
    cwd,
    extraWritableRoots: await extraWritableRootsForMounts(mounts)
  });
  return spawnHostProcess({
    wrappedArgv,
    cwd,
    env: mapEnvPaths(await hostProcessEnv(root, opts.env), mapOpts),
    opts,
    maxBuffer: opts.maxBuffer ?? DEFAULT_MAX_BUFFER
  });
}

async function hostCreateSession(
  sessionId: string,
  opts?: CreateOpts
): Promise<WorkspaceHandle> {
  try {
    const { checkHostToolchain } = await import("../hostToolchain.js");
    const toolchain = await checkHostToolchain();
    if (!toolchain.ok) {
      console.warn(
        `[host-runtime] missing toolchain: ${toolchain.missing.join(", ")}. ${toolchain.guidance.join(" ")}`
      );
    }
    await ensureSessionsRoot();
    const bindMounts = workspaceMountsFromBinds(opts?.bindMounts);
    const { root, mounts } = await ensureHostWorkspaceRoot({
      sessionId,
      mounts: bindMounts
    });
    await fs.mkdir(root, { recursive: true });
    await fs.mkdir(path.join(root, ".forge-runtime"), { recursive: true });
    const managed = hostManagedSessionRoot(sessionId);
    if (path.resolve(root) !== path.resolve(managed)) {
      await fs.mkdir(path.join(managed, ".forge-runtime"), {
        recursive: true
      });
    }
    sessionStates.set(sessionId, {
      root,
      mounts,
      extraWritableRoots: await extraWritableRootsForMounts(mounts)
    });
    return { sessionId, runtime: "host", ref: root };
  } catch (err) {
    throw new SandboxRuntimeError({
      code: "workspace_unavailable",
      message:
        err instanceof Error ? err.message : "failed to create host workspace",
      cause: err
    });
  }
}

async function hostGetStatus(sessionId: string): Promise<SessionRuntimeStatus> {
  const state = sessionStates.get(sessionId);
  if (!state) {
    const candidate = path.join(
      resolveSessionsRoot(),
      "_host",
      sanitizeSessionFsName(sessionId)
    );
    try {
      await fs.access(candidate);
      return {
        status: "ready",
        running: true,
        workingDir: WORKSPACE_MOUNT,
        ref: candidate
      };
    } catch {
      return { status: "absent", running: false };
    }
  }
  return {
    status: "ready",
    running: true,
    workingDir: WORKSPACE_MOUNT,
    ref: state.root
  };
}

async function killHostRuntimePids(root: string): Promise<void> {
  const runtimeDir = path.join(root, ".forge-runtime");
  let entries: string[];
  try {
    entries = await fs.readdir(runtimeDir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!name.endsWith(".pid")) continue;
    try {
      const raw = await fs.readFile(path.join(runtimeDir, name), "utf8");
      const pid = Number(raw.trim());
      if (!Number.isFinite(pid) || pid <= 0) continue;
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        void 0;
      }
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        void 0;
      }
      await fs.rm(path.join(runtimeDir, name), { force: true });
    } catch {
      void 0;
    }
  }
}

async function removeHostManagedSessionDir(
  sessionId: string,
  sessionRoot?: string
): Promise<void> {
  const managed = path.resolve(hostManagedSessionRoot(sessionId));
  await fs.rm(managed, { recursive: true, force: true }).catch(() => {});
  if (
    sessionRoot &&
    isUnderHostManagedRoot(sessionRoot) &&
    path.resolve(sessionRoot) !== managed
  ) {
    await fs.rm(sessionRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export function listHostActiveSessionIds(): string[] {
  return [...sessionStates.keys()];
}

export function createHostSandboxRuntime(): SandboxRuntime {
  return {
    kind: "host",
    createSession: hostCreateSession,
    async exec(input: RuntimeExecInput): Promise<ExecResult> {
      const { handle, cmd, ...opts } = input;
      const state = sessionStates.get(handle.sessionId);
      const root = state?.root ?? handle.ref;
      const mounts = state?.mounts ?? [];
      if (cmd.length === 0) {
        return { code: 1, stdout: "", stderr: "empty command" };
      }
      return hostExec({ root, mounts, argv: cmd, opts });
    },
    getStatus: hostGetStatus,
    resolveListenPort: hostResolveListenPort,
    resolvePublishedPort: async (_sessionId, listenPort) => listenPort,
    ensurePublishedPortReady: hostEnsurePublishedPortReady,
    publishedAppPortsEnv: hostPublishedAppPortsEnv,
    isAllowedListenPort: isHostRegistryPort,
    previewHostname: hostPreviewHostname,
    publishPreviewPort: hostPublishPreviewPort,
    async destroySession(sessionId: string): Promise<void> {
      await revokePreviewSession(sessionId);
      const state = sessionStates.get(sessionId);
      if (state) {
        const { destroyHostShells } = await import("../hostSessionPty.js");
        destroyHostShells(state.root);
        await killHostRuntimePids(state.root);
      }
      await releaseSessionPorts(sessionId);
      sessionStates.delete(sessionId);
      await removeHostManagedSessionDir(sessionId, state?.root);
    }
  };
}
