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
} & ExecOptions;
const DEFAULT_MAX_BUFFER = N_16 * N_1024 * N_1024;
export function dockerExec(input: DockerExecInput): Promise<ExecResult> {
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
export function shInSandbox(
  options: {
    container: string;
    script: string;
  } & ExecOptions
): Promise<ExecResult> {
  const { container, script, ...opts } = options;
  return dockerExec({ container, argv: ["sh", "-c", script], ...opts });
}
export function resolveWorkspacePath(
  relative: string,
  options?: { knownRepos?: ReadonlySet<string> | string[] }
): string {
  const cleaned = String(relative || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
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
  const { getSandboxRuntime, resolveSandboxRuntimeKind } =
    await import("./sandboxRuntime/resolve.js");
  const runtime = getSandboxRuntime();
  const info = await resolveSandbox(sessionId);
  return runtime.exec({
    handle: {
      sessionId,
      runtime: resolveSandboxRuntimeKind(),
      ref: info.hostWorkingDir ?? info.containerName
    },
    cmd: argv,
    ...opts
  });
}
export async function pathExistsInSandbox(
  container: string,
  absPath: string
): Promise<boolean> {
  const r = await dockerExec({ container, argv: ["test", "-e", absPath] });
  return r.code === 0;
}
export async function readFileFromSandbox(
  container: string,
  absPath: string
): Promise<string | null> {
  const r = await dockerExec({ container, argv: ["cat", "--", absPath] });
  if (r.code !== 0) {
    return null;
  }
  return r.stdout;
}
export async function writeFileToSandbox(options: {
  container: string;
  absPath: string;
  content: string;
}): Promise<void> {
  const { container, absPath, content } = options;
  const r = await shInSandbox({
    container,
    script: 'mkdir -p "$(dirname "$P")" && cat > "$P"',
    input: content,
    env: { P: absPath }
  });
  if (r.code !== 0) {
    throw new Error(r.stderr.trim() || `failed to write ${absPath}`);
  }
}
