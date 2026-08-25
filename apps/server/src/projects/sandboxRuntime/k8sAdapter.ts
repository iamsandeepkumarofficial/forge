import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { FIRST_APP_PORT } from "../sessionSandbox/constants.js";
import {
  previewUrlForHostname,
  sanitizeSessionIdForHostname,
  sessionPreviewHostname,
  sessionPreviewHostnameForPort
} from "./hostnames.js";
import {
  registerPreviewRoute,
  revokePreviewSession
} from "../../preview/previewPlaneClient.js";
import type {
  CreateOpts,
  ExecResult,
  PreviewBinding,
  RuntimeExecInput,
  SandboxRuntime,
  WorkspaceHandle
} from "./types.js";
import { SandboxRuntimeError } from "./types.js";

const N_63 = 63;
const N_16 = 16;
const N_1024 = 1024;
const DEFAULT_MAX_BUFFER = N_16 * N_1024 * N_1024;
const execFileAsync = promisify(execFile);

export type K8sWorkspaceClient = {
  namespace: string;
  createWorkspace(input: {
    sessionId: string;
    image: string;
  }): Promise<{ podName: string; serviceName: string }>;
  exec(input: {
    podName: string;
    cmd: string[];
    cwd?: string;
    env?: Record<string, string>;
    detach?: boolean;
    stdin?: string | Buffer;
  }): Promise<ExecResult>;
  destroyWorkspace(sessionId: string): Promise<void>;
};

export function sandboxResourceName(sessionId: string): string {
  const id = sanitizeSessionIdForHostname(sessionId);
  return `forge-sess-${id}`.slice(0, N_63);
}

function workspaceManifest(input: {
  name: string;
  sessionId: string;
  image: string;
  namespace: string;
}): string {
  const port = FIRST_APP_PORT;
  return `apiVersion: v1
kind: Pod
metadata:
  name: ${input.name}
  namespace: ${input.namespace}
  labels:
    app.kubernetes.io/name: forge-sandbox
    forge.io/session: ${input.sessionId}
spec:
  containers:
    - name: sandbox
      image: ${input.image}
      ports:
        - containerPort: ${port}
      volumeMounts:
        - name: workspace
          mountPath: /workspace
  volumes:
    - name: workspace
      emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: ${input.name}
  namespace: ${input.namespace}
  labels:
    forge.io/session: ${input.sessionId}
spec:
  selector:
    forge.io/session: ${input.sessionId}
  ports:
    - name: app
      port: ${port}
      targetPort: ${port}
`;
}

function kubectlExec(input: {
  args: string[];
  stdin?: string | Buffer;
  maxBuffer: number;
}): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("kubectl", input.args, {
      stdio: ["pipe", "pipe", "pipe"]
    });
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let outLen = 0;
    let errLen = 0;
    child.stdout.on("data", (c: Buffer) => {
      if (outLen < input.maxBuffer) {
        outChunks.push(c);
        outLen += c.length;
      }
    });
    child.stderr.on("data", (c: Buffer) => {
      if (errLen < input.maxBuffer) {
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
    if (input.stdin !== undefined) {
      child.stdin.end(input.stdin);
    } else {
      child.stdin.end();
    }
  });
}

function kubectlApply(input: {
  manifest: string;
  namespace: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "kubectl",
      ["apply", "-n", input.namespace, "-f", "-"],
      { stdio: ["pipe", "pipe", "pipe"] }
    );
    child.stdin.write(input.manifest);
    child.stdin.end();
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`kubectl apply exited ${code}`));
    });
  });
}

export function createKubectlSandboxClient(
  namespace = process.env.FORGE_SANDBOX_NAMESPACE?.trim() || "forge"
): K8sWorkspaceClient {
  return {
    namespace,
    async createWorkspace(input) {
      const name = sandboxResourceName(input.sessionId);
      await kubectlApply({
        namespace,
        manifest: workspaceManifest({
          name,
          sessionId: input.sessionId,
          image: input.image,
          namespace
        })
      });
      return { podName: name, serviceName: name };
    },
    async exec(input) {
      const args = ["exec", "-n", namespace, input.podName, "--"];
      if (input.cwd) {
        args.push(
          "sh",
          "-c",
          `cd ${JSON.stringify(input.cwd)} && exec "$@"`,
          "--"
        );
      }
      args.push(...input.cmd);
      if (input.detach) {
        await execFileAsync("kubectl", args).catch(() => undefined);
        return { code: 0, stdout: "", stderr: "" };
      }
      return kubectlExec({
        args,
        stdin: input.stdin,
        maxBuffer: DEFAULT_MAX_BUFFER
      });
    },
    async destroyWorkspace(sessionId) {
      const name = sandboxResourceName(sessionId);
      await execFileAsync("kubectl", [
        "delete",
        "pod,svc",
        name,
        "-n",
        namespace,
        "--ignore-not-found"
      ]).catch(() => undefined);
    }
  };
}

export function createK8sSandboxRuntime(
  client?: K8sWorkspaceClient
): SandboxRuntime {
  const c = client ?? createKubectlSandboxClient();
  return {
    async createSession(
      sessionId: string,
      opts?: CreateOpts
    ): Promise<WorkspaceHandle> {
      try {
        const image =
          opts?.image ||
          process.env.FORGE_SANDBOX_IMAGE?.trim() ||
          "forge-sandbox:latest";
        const created = await c.createWorkspace({ sessionId, image });
        return {
          sessionId,
          runtime: "kubernetes",
          ref: created.podName
        };
      } catch (err) {
        throw new SandboxRuntimeError({
          code: "workspace_unavailable",
          message:
            err instanceof Error
              ? err.message
              : "failed to create k8s workspace",
          cause: err
        });
      }
    },
    async exec(input: RuntimeExecInput): Promise<ExecResult> {
      return c.exec({
        podName: input.handle.ref,
        cmd: input.cmd,
        cwd: input.cwd,
        env: input.env,
        detach: input.detach,
        stdin: input.input
      });
    },
    async publishPreviewPort(
      handle: WorkspaceHandle,
      port: number
    ): Promise<PreviewBinding> {
      const hostname =
        port === FIRST_APP_PORT
          ? sessionPreviewHostname(handle.sessionId)
          : sessionPreviewHostnameForPort(handle.sessionId, port);
      const backendService = `${sandboxResourceName(handle.sessionId)}.${c.namespace}.svc.cluster.local:${port}`;
      const registered = await registerPreviewRoute({
        sessionId: handle.sessionId,
        port,
        backendService,
        hostname
      });
      const scheme = process.env.PREVIEW_URL_SCHEME?.trim() || "https";
      return {
        hostname: registered?.hostname ?? hostname,
        targetPort: port,
        url: registered?.url ?? previewUrlForHostname(hostname, scheme)
      };
    },
    async destroySession(sessionId: string): Promise<void> {
      await revokePreviewSession(sessionId);
      await c.destroyWorkspace(sessionId);
    }
  };
}
