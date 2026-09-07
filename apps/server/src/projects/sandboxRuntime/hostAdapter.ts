import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  sessionPreviewHostname,
  sessionPreviewHostnameForPort
} from "./hostnames.js";
import {
  registerPreviewRoute,
  revokePreviewSession
} from "../../preview/previewPlaneClient.js";
import {
  FIRST_APP_PORT,
  WORKSPACE_MOUNT
} from "../sessionSandbox/constants.js";
import {
  ensureSessionsRoot,
  resolveSessionsRoot
} from "../../services/project/projectsRoot.js";
import { releaseSessionPorts } from "./sessionPortRegistry.js";
import type {
  CreateOpts,
  ExecOpts,
  ExecResult,
  PreviewBinding,
  RuntimeExecInput,
  SandboxRuntime,
  SessionRuntimeStatus,
  WorkspaceHandle
} from "./types.js";
import { SandboxRuntimeError } from "./types.js";

const N_16 = 16;
const N_48 = 48;
const N_1024 = 1024;
const DEFAULT_MAX_BUFFER = N_16 * N_1024 * N_1024;

const ENV_ALLOWLIST = new Set([
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TMPDIR",
  "TEMP",
  "TMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "COLORTERM",
  "NODE_OPTIONS",
  "npm_config_cache",
  "PNPM_HOME",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy"
]);

const sessionRoots = new Map<string, string>();

function sanitizeSessionFsName(sessionId: string): string {
  const cleaned = sessionId.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, N_48);
  return cleaned.replace(/^[._-]+/, "") || "session";
}

export function hostSessionRuntimeDir(sessionId: string): string {
  return path.join(
    resolveSessionsRoot(),
    "_host",
    sanitizeSessionFsName(sessionId),
    ".forge-runtime"
  );
}

function workspaceHostPath(opts?: CreateOpts): string | undefined {
  return opts?.bindMounts?.find((m) => m.containerPath === WORKSPACE_MOUNT)
    ?.hostPath;
}

function scrubEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const key of ENV_ALLOWLIST) {
    const v = process.env[key];
    if (v !== undefined) out[key] = v;
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      out[k] = v;
    }
  }
  return out;
}

function mapEnvPaths(env: NodeJS.ProcessEnv, root: string): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env };
  for (const key of Object.keys(out)) {
    const v = out[key];
    if (typeof v === "string") {
      out[key] = mapWorkspaceArg(v, root);
    }
  }
  return out;
}

function mapWorkspaceArg(arg: string, root: string): string {
  if (arg === WORKSPACE_MOUNT || arg.startsWith(`${WORKSPACE_MOUNT}/`)) {
    return path.join(
      root,
      arg.slice(WORKSPACE_MOUNT.length).replace(/^\//, "")
    );
  }
  return arg;
}

function mapWorkspacePath(cwd: string | undefined, root: string): string {
  if (!cwd) return root;
  if (cwd === WORKSPACE_MOUNT || cwd.startsWith(`${WORKSPACE_MOUNT}/`)) {
    return path.join(
      root,
      cwd.slice(WORKSPACE_MOUNT.length).replace(/^\//, "")
    );
  }
  return cwd;
}

function hostExec(input: {
  root: string;
  argv: string[];
  opts: ExecOpts;
}): Promise<ExecResult> {
  const { root, opts } = input;
  const argv = input.argv.map((a) => mapWorkspaceArg(a, root));
  const cwd = mapWorkspacePath(opts.cwd, root);
  const maxBuffer = opts.maxBuffer ?? DEFAULT_MAX_BUFFER;
  const env = mapEnvPaths(scrubEnv(opts.env), root);
  return new Promise<ExecResult>((resolve, reject) => {
    const child = spawn(argv[0]!, argv.slice(1), {
      cwd,
      env,
      detached: Boolean(opts.detach),
      stdio: opts.detach ? "ignore" : ["pipe", "pipe", "pipe"]
    });
    if (opts.detach) {
      child.unref();
      resolve({ code: 0, stdout: "", stderr: "" });
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

async function hostCreateSession(
  sessionId: string,
  opts?: CreateOpts
): Promise<WorkspaceHandle> {
  try {
    await ensureSessionsRoot();
    const ws = workspaceHostPath(opts);
    const root =
      ws ??
      path.join(
        resolveSessionsRoot(),
        "_host",
        sanitizeSessionFsName(sessionId)
      );
    await fs.mkdir(root, { recursive: true });
    await fs.mkdir(path.join(root, ".forge-runtime"), { recursive: true });
    sessionRoots.set(sessionId, root);
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
  const root = sessionRoots.get(sessionId);
  if (!root) {
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
    ref: root
  };
}

async function hostPublishPreviewPort(
  handle: WorkspaceHandle,
  port: number
): Promise<PreviewBinding> {
  const hostname =
    port === FIRST_APP_PORT
      ? sessionPreviewHostname(handle.sessionId)
      : sessionPreviewHostnameForPort(handle.sessionId, port);
  const backendService = `127.0.0.1:${port}`;
  const localUrl = `http://127.0.0.1:${port}`;
  const registered = await registerPreviewRoute({
    sessionId: handle.sessionId,
    port,
    backendService,
    hostname
  });
  return {
    hostname: registered?.hostname ?? hostname,
    targetPort: port,
    url: registered?.url ?? localUrl
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

export function createHostSandboxRuntime(): SandboxRuntime {
  return {
    createSession: hostCreateSession,
    async exec(input: RuntimeExecInput): Promise<ExecResult> {
      const { handle, cmd, ...opts } = input;
      const root = sessionRoots.get(handle.sessionId) ?? handle.ref;
      if (cmd.length === 0) {
        return { code: 1, stdout: "", stderr: "empty command" };
      }
      return hostExec({ root, argv: cmd, opts });
    },
    getStatus: hostGetStatus,
    publishPreviewPort: hostPublishPreviewPort,
    async destroySession(sessionId: string): Promise<void> {
      await revokePreviewSession(sessionId);
      const root = sessionRoots.get(sessionId);
      if (root) {
        await killHostRuntimePids(root);
      }
      await releaseSessionPorts(sessionId);
      sessionRoots.delete(sessionId);
    }
  };
}
