import { createDockerSandboxRuntime } from "./dockerAdapter.js";
import { createK8sSandboxRuntime } from "./k8sAdapter.js";
import type { SandboxRuntime, SandboxRuntimeKind } from "./types.js";

let cached: SandboxRuntime | undefined;

export function resolveSandboxRuntimeKind(): SandboxRuntimeKind {
  const raw = process.env.SANDBOX_RUNTIME?.trim().toLowerCase();
  if (raw === "kubernetes" || raw === "k8s") {
    return "kubernetes";
  }
  return "docker";
}

export function getSandboxRuntime(): SandboxRuntime {
  if (cached) {
    return cached;
  }
  const kind = resolveSandboxRuntimeKind();
  cached =
    kind === "kubernetes"
      ? createK8sSandboxRuntime()
      : createDockerSandboxRuntime();
  return cached;
}

export function resetSandboxRuntimeCache(): void {
  cached = undefined;
}
