import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ensureContainer, ensureVolume } from "../sessionSandbox/container.js";
import {
  FIRST_APP_PORT,
  hostPortForContainerPort,
  sandboxContainerName,
  sessionVolumeName
} from "../sessionSandbox/constants.js";
import {
  previewUrlForHostname,
  sessionPreviewHostname,
  sessionPreviewHostnameForPort
} from "./hostnames.js";
import {
  registerPreviewRoute,
  revokePreviewSession
} from "../../preview/previewPlaneClient.js";
import type {
  CreateOpts,
  ExecOpts,
  ExecResult,
  PreviewBinding,
  RuntimeExecInput,
  SandboxRuntime,
  WorkspaceHandle
} from "./types.js";
import { SandboxRuntimeError } from "./types.js";

const N_1024 = 1024;
const N_16 = 16;
const DEFAULT_MAX_BUFFER = N_16 * N_1024 * N_1024;
const execFileAsync = promisify(execFile);

type DockerExecRawInput = {
  container: string;
  argv: string[];
} & ExecOpts;

function dockerExecRaw(input: DockerExecRawInput): Promise<ExecResult> {
  const { container, argv, ...opts } = input;
  const args = ["exec"];
  if (opts.detach) args.push("-d");
  if (opts.input !== undefined) args.push("-i");
  if (opts.env) {
    for (const [k, v] of Object.entries(opts.env)) {
      args.push("-e", `${k}=${v}`);
    }
  }
  if (opts.cwd) args.push("-w", opts.cwd);
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

export function createDockerSandboxRuntime(): SandboxRuntime {
  return {
    async createSession(
      sessionId: string,
      opts?: CreateOpts
    ): Promise<WorkspaceHandle> {
      try {
        const volumeName = await ensureVolume(sessionId);
        await ensureContainer(sessionId, volumeName, {
          bindMounts: opts?.bindMounts,
          namedVolumes: opts?.namedVolumes,
          containerEnv: opts?.containerEnv,
          image: opts?.image
        });
        return {
          sessionId,
          runtime: "docker",
          ref: sandboxContainerName(sessionId)
        };
      } catch (err) {
        throw new SandboxRuntimeError({
          code: "workspace_unavailable",
          message:
            err instanceof Error ? err.message : "failed to create workspace",
          cause: err
        });
      }
    },

    async exec(input: RuntimeExecInput): Promise<ExecResult> {
      const { handle, cmd, ...opts } = input;
      return dockerExecRaw({
        container: handle.ref,
        argv: cmd,
        ...opts
      });
    },

    async publishPreviewPort(
      handle: WorkspaceHandle,
      port: number
    ): Promise<PreviewBinding> {
      const hostPort = hostPortForContainerPort(handle.sessionId, port);
      const hostname =
        hostPort === null || port === FIRST_APP_PORT
          ? sessionPreviewHostname(handle.sessionId)
          : sessionPreviewHostnameForPort(handle.sessionId, port);
      const localUrl =
        hostPort !== null
          ? `http://127.0.0.1:${hostPort}`
          : previewUrlForHostname(hostname, "http");
      const backendService =
        hostPort !== null ? `127.0.0.1:${hostPort}` : `127.0.0.1:${port}`;
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
    },

    async destroySession(sessionId: string): Promise<void> {
      await revokePreviewSession(sessionId);
      const containerName = sandboxContainerName(sessionId);
      const volumeName = sessionVolumeName(sessionId);
      await execFileAsync("docker", ["rm", "-f", containerName]).catch(
        () => undefined
      );
      await execFileAsync("docker", ["volume", "rm", volumeName]).catch(
        () => undefined
      );
    }
  };
}
