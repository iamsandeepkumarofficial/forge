import { createDockerSandboxRuntime } from "./dockerAdapter.js";
import { createHostSandboxRuntime } from "./hostAdapter.js";
import { createK8sSandboxRuntime } from "./k8sAdapter.js";
import type { SandboxRuntime, SandboxRuntimeKind } from "./types.js";

let cached: SandboxRuntime | undefined;

export function resolveSandboxRuntimeKind(): SandboxRuntimeKind {
  const raw = process.env.SANDBOX_RUNTIME?.trim().toLowerCase();
  if (raw === "host") {
    return "host";
  }
  if (raw === "kubernetes" || raw === "k8s") {
    return "kubernetes";
  }
  if (raw === "docker") {
    return "docker";
  }
  if (process.env.FORGE_DESKTOP?.trim() === "1") {
    return "host";
  }
  return "docker";
}

export function getSandboxRuntime(): SandboxRuntime {
  if (cached) {
    return cached;
  }
  const kind = resolveSandboxRuntimeKind();
  if (kind === "kubernetes") {
    cached = createK8sSandboxRuntime();
  } else if (kind === "host") {
    cached = createHostSandboxRuntime();
  } else {
    cached = createDockerSandboxRuntime();
  }
  return cached;
}

export function resetSandboxRuntimeCache(): void {
  cached = undefined;
}
