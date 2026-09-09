export type {
  BindMount,
  CreateOpts,
  ExecOpts,
  ExecResult,
  PreviewBinding,
  RuntimeExecInput,
  SandboxRuntime,
  SandboxRuntimeErrorCode,
  SandboxRuntimeKind,
  SessionRuntimeStatus,
  SessionRuntimeStatusKind,
  WorkspaceHandle
} from "./types.js";
export { SandboxRuntimeError } from "./types.js";
export {
  previewBaseDomain,
  previewUrlForHostname,
  sanitizeSessionIdForHostname,
  sessionPreviewHostname,
  sessionPreviewHostnameForPort
} from "./hostnames.js";
export { createDockerSandboxRuntime } from "./dockerAdapter.js";
export {
  createHostSandboxRuntime,
  listHostActiveSessionIds,
  mapHostLogicalPath,
  workspaceMountsFromBinds,
  extraWritableRootsForHostRoot
} from "./hostAdapter.js";
export { createK8sSandboxRuntime, sandboxResourceName } from "./k8sAdapter.js";
export {
  hostSandboxEnabled,
  wrapHostCommand,
  defaultWritableRoots,
  resolveWrappedArgv
} from "./osSandbox.js";
export {
  allocateSessionPort,
  listSessionPortAllocations,
  loadSessionPortRegistry,
  portsForSession,
  releaseSessionPort,
  releaseSessionPorts,
  resetSessionPortRegistryForTests
} from "./sessionPortRegistry.js";
export {
  cloudSandboxKindFromEnv,
  executionTargetToKind,
  forgetSessionRuntimeKind,
  getSandboxRuntime,
  getSandboxRuntimeByKind,
  isHostSession,
  parseExecutionTarget,
  rememberSessionExecutionTarget,
  resetSandboxRuntimeCache,
  resolveSandboxRuntimeKindForSession
} from "./resolve.js";
