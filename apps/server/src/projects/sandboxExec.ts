import { spawn } from "node:child_process";
import {
  provisionSessionSandbox,
  getSessionRepoInfo,
  type SessionRepoInfo
} from "./sessionSandbox.js";
import { WORKSPACE_MOUNT } from "./sessionSandbox/constants.js";

const N_1024 = 1024;
const N_16 = 16;

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  pid?: number;
}
export interface ExecOptions {
  cwd?: string;
  input?: string | Buffer;
  env?: Record<string, string>;
  maxBuffer?: number;
  detach?: boolean;
}
export type DockerExecInput = {
  container: string;
  argv: string[];
  sessionId?: string;
} & ExecOptions;
const DEFAULT_MAX_BUFFER = N_16 * N_1024 * N_1024;

function looksLikeHostFsRef(container: string): boolean {
  const c = container.trim();
  if (!c) return false;
  if (c.startsWith("host:")) return true;
  if (c.startsWith("/")) return true;
  if (/^[A-Za-z]:[\\/]/.test(c)) return true;
  return c.includes("/.forge/") || c.includes("\\.forge\\");
}

export function dockerExecDirect(input: DockerExecInput): Promise<ExecResult> {
  const { container, argv, ...opts } = input;
  const args = ["exec"];
  if (opts.detach) {
    args.push("-d");
  }
  if (opts.input !== undefined) {
    args.push("-i");
  }
  if (opts.env) {
    for (const [k, v] of Object.entries(opts.env)) {
      args.push("-e", `${k}=${v}`);
    }
  }
  if (opts.cwd) {
    args.push("-w", opts.cwd);
  }
  args.push(container, ...argv);
  const maxBuffer = opts.maxBuffer ?? DEFAULT_MAX_BUFFER;
  return new Promise<ExecResult>((resolve, reject) => {
    const child = spawn("docker", args, { env: process.env });
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let outLen = 0;
    let errLen = 0;
    child.stdout.on("data", (c: Buffer) => {
      if (outLen < maxBuffer) {
        outChunks.push(c);
        outLen += c.length;
      }
    });
    child.stderr.on("data", (c: Buffer) => {
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
      child.stdin.end(opts.input);
    } else {
      child.stdin.end();
    }
  });
}

export async function dockerExec(input: DockerExecInput): Promise<ExecResult> {
  const { container, argv, sessionId, ...opts } = input;
  if (!sessionId && looksLikeHostFsRef(container)) {
    throw new Error(
      `Missing sessionId for host workspace exec (ref=${container}). ` +
        `Pass sessionId so Forge uses the host runtime instead of Docker.`
    );
  }
  const {
    getSandboxRuntime,
    getSandboxRuntimeByKind,
    resolveSandboxRuntimeKindForSession
  } = await import("./sandboxRuntime/resolve.js");
  const kind = sessionId
    ? await resolveSandboxRuntimeKindForSession(sessionId)
    : "docker";
  const runtime = sessionId
    ? await getSandboxRuntime(sessionId)
    : getSandboxRuntimeByKind("docker");
  return runtime.exec({
    handle: {
      sessionId: sessionId ?? container,
      runtime: kind,
      ref: container
    },
    cmd: argv,
    ...opts
  });
}

export function shInSandbox(
  options: {
    container: string;
    script: string;
    sessionId?: string;
  } & ExecOptions
): Promise<ExecResult> {
  const { container, script, sessionId, ...opts } = options;
  return dockerExec({
    container,
    sessionId,
    argv: ["sh", "-c", script],
    ...opts
  });
}
export function resolveWorkspacePath(
  relative: string,
  options?: { knownRepos?: ReadonlySet<string> | string[] }
): string {
  let cleaned = String(relative || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (cleaned === "workspace" || cleaned.startsWith("workspace/")) {
    cleaned = cleaned.slice("workspace".length).replace(/^\/+/, "");
  }
  const segments: string[] = [];
  for (const seg of cleaned.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      throw new Error(
        "Invalid path: traversal outside the workspace is not allowed"
      );
    }
    segments.push(seg);
  }
  const known = options?.knownRepos
    ? options.knownRepos instanceof Set
      ? options.knownRepos
      : new Set(options.knownRepos)
    : null;
  if (known && known.size > 0 && segments.length > 0) {
    const first = segments[0];
    if (!known.has(first)) {
      throw new Error(
        `Invalid path: first segment must be a member repo (${[...known].sort().join(", ")}), got "${first}"`
      );
    }
  }
  return `${WORKSPACE_MOUNT}/${segments.join("/")}`;
}
export async function resolveSandbox(
  sessionId: string
): Promise<SessionRepoInfo> {
  await provisionSessionSandbox(sessionId);
  return getSessionRepoInfo(sessionId);
}

export async function runtimeExec(
  input: {
    sessionId: string;
    argv: string[];
  } & ExecOptions
): Promise<ExecResult> {
  const { sessionId, argv, ...opts } = input;
  const info = await resolveSandbox(sessionId);
  return dockerExec({
    container: info.containerName,
    sessionId,
    argv,
    ...opts
  });
}
async function sandboxTest(options: {
  container: string;
  absPath: string;
  sessionId: string;
  flag: "-e" | "-f" | "-d";
}): Promise<boolean> {
  const r = await dockerExec({
    container: options.container,
    sessionId: options.sessionId,
    argv: ["test", options.flag, options.absPath]
  });
  return r.code === 0;
}

export async function pathExistsInSandbox(options: {
  container: string;
  absPath: string;
  sessionId: string;
}): Promise<boolean> {
  return sandboxTest({ ...options, flag: "-e" });
}

export async function isFileInSandbox(options: {
  container: string;
  absPath: string;
  sessionId: string;
}): Promise<boolean> {
  return sandboxTest({ ...options, flag: "-f" });
}
export async function readFileFromSandbox(options: {
  container: string;
  absPath: string;
  sessionId: string;
}): Promise<string | null> {
  const r = await dockerExec({
    container: options.container,
    sessionId: options.sessionId,
    argv: ["cat", "--", options.absPath]
  });
  if (r.code !== 0) {
    return null;
  }
  return r.stdout;
}
export async function writeFileToSandbox(options: {
  container: string;
  absPath: string;
  content: string;
  sessionId: string;
}): Promise<void> {
  const { container, absPath, content, sessionId } = options;
  const r = await shInSandbox({
    container,
    sessionId,
    script: 'mkdir -p "$(dirname "$P")" && cat > "$P"',
    input: content,
    env: { P: absPath }
  });
  if (r.code !== 0) {
    throw new Error(r.stderr.trim() || `failed to write ${absPath}`);
  }
}

export async function deleteFileFromSandbox(options: {
  container: string;
  absPath: string;
  sessionId: string;
}): Promise<void> {
  const isFile = await isFileInSandbox(options);
  if (!isFile) {
    if (await pathExistsInSandbox(options)) {
      throw new Error("Not a file");
    }
    return;
  }
  const r = await dockerExec({
    container: options.container,
    sessionId: options.sessionId,
    argv: ["rm", "-f", "--", options.absPath]
  });
  if (r.code !== 0) {
    throw new Error(r.stderr.trim() || `failed to delete ${options.absPath}`);
  }
}

export async function moveFileInSandbox(options: {
  container: string;
  fromAbs: string;
  toAbs: string;
  sessionId: string;
}): Promise<void> {
  const isFile = await isFileInSandbox({
    container: options.container,
    absPath: options.fromAbs,
    sessionId: options.sessionId
  });
  if (!isFile) {
    throw new Error("Not a file");
  }
  const destIsDir = await sandboxTest({
    container: options.container,
    absPath: options.toAbs,
    sessionId: options.sessionId,
    flag: "-d"
  });
  if (destIsDir) {
    throw new Error("Not a file");
  }
  const r = await shInSandbox({
    container: options.container,
    sessionId: options.sessionId,
    script: 'mkdir -p "$(dirname "$TO")" && mv -- "$FROM" "$TO"',
    env: { FROM: options.fromAbs, TO: options.toAbs }
  });
  if (r.code !== 0) {
    throw new Error(r.stderr.trim() || `failed to move ${options.fromAbs}`);
  }
}
