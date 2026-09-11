export type SandboxRuntimeKind = "docker" | "kubernetes" | "host";

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
  pid?: number;
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

export type SessionRuntimeStatusKind = "absent" | "empty" | "ready";

export interface SessionRuntimeStatus {
  status: SessionRuntimeStatusKind;
  running: boolean;
  workingDir?: string;
  ref?: string;
}

export type RuntimeExecInput = {
  handle: WorkspaceHandle;
  cmd: string[];
} & ExecOpts;

export type ResolveListenPortInput = {
  sessionId: string;
  appName: string;
  preferred?: number;
  usedListenPorts: number[];
};

export type EnsurePublishedPortReadyInput = {
  handle: WorkspaceHandle;
  listenPort: number;
  publishedPort: number;
  onRepairRestart?: () => Promise<boolean>;
};

export interface SandboxRuntime {
  readonly kind: SandboxRuntimeKind;
  createSession(sessionId: string, opts?: CreateOpts): Promise<WorkspaceHandle>;
  exec(input: RuntimeExecInput): Promise<ExecResult>;
  getStatus(sessionId: string): Promise<SessionRuntimeStatus>;
  resolveListenPort(input: ResolveListenPortInput): Promise<number>;
  resolvePublishedPort(
    sessionId: string,
    listenPort: number
  ): Promise<number | null>;
  ensurePublishedPortReady(
    input: EnsurePublishedPortReadyInput
  ): Promise<boolean>;
  publishedAppPortsEnv(): string;
  isAllowedListenPort(port: number): boolean;

  previewHostname(sessionId: string, listenPort: number): string;
  publishPreviewPort(
    handle: WorkspaceHandle,
    port: number
  ): Promise<PreviewBinding>;
  unpublishPreviewPort?(handle: WorkspaceHandle, port: number): Promise<void>;
  destroySession(sessionId: string): Promise<void>;
}
