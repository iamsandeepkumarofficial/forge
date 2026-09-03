export type SandboxRuntimeKind = "docker" | "kubernetes";

export type SandboxRuntimeErrorCode =
  | "workspace_unavailable"
  | "preview_route_failed"
  | "preview_hostname_collision";

export class SandboxRuntimeError extends Error {
  readonly code: SandboxRuntimeErrorCode;

  constructor(input: {
    code: SandboxRuntimeErrorCode;
    message: string;
    cause?: unknown;
  }) {
    super(
      input.message,
      input.cause !== undefined ? { cause: input.cause } : undefined
    );
    this.name = "SandboxRuntimeError";
    this.code = input.code;
  }
}

export interface BindMount {
  hostPath: string;
  containerPath: string;
  readOnly?: boolean;
}

export interface NamedVolumeMount {
  volumeName: string;
  containerPath: string;
}

export interface CreateOpts {
  image?: string;
  labels?: Record<string, string>;
  bindMounts?: BindMount[];
  namedVolumes?: NamedVolumeMount[];
  containerEnv?: Record<string, string>;
}

export interface ExecOpts {
  cwd?: string;
  input?: string | Buffer;
  env?: Record<string, string>;
  maxBuffer?: number;
  detach?: boolean;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface PreviewBinding {
  hostname: string;
  targetPort: number;
  url: string;
}

export interface WorkspaceHandle {
  sessionId: string;
  runtime: SandboxRuntimeKind;
  ref: string;
}

export type RuntimeExecInput = {
  handle: WorkspaceHandle;
  cmd: string[];
} & ExecOpts;

export interface SandboxRuntime {
  createSession(sessionId: string, opts?: CreateOpts): Promise<WorkspaceHandle>;
  exec(input: RuntimeExecInput): Promise<ExecResult>;
  publishPreviewPort(
    handle: WorkspaceHandle,
    port: number
  ): Promise<PreviewBinding>;
  unpublishPreviewPort?(handle: WorkspaceHandle, port: number): Promise<void>;
  destroySession(sessionId: string): Promise<void>;
}
