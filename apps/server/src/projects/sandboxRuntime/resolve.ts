import type { ExecutionTarget } from "@forge/db";
import { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import { createDockerSandboxRuntime } from "./dockerAdapter.js";
import { createHostSandboxRuntime } from "./hostAdapter.js";
import { createK8sSandboxRuntime } from "./k8sAdapter.js";
import type { SandboxRuntime, SandboxRuntimeKind } from "./types.js";

const adapters = new Map<SandboxRuntimeKind, SandboxRuntime>();
const sessionKindCache = new Map<string, SandboxRuntimeKind>();

export function parseExecutionTarget(
  raw: unknown
): ExecutionTarget | undefined {
  if (raw === "local" || raw === "cloud") return raw;
  return undefined;
}

export function cloudSandboxKindFromEnv(
  env: NodeJS.ProcessEnv = process.env
): SandboxRuntimeKind {
  const raw = env.FORGE_CLOUD_SANDBOX?.trim().toLowerCase();
  if (raw === "kubernetes" || raw === "k8s") return "kubernetes";
  return "docker";
}

export function executionTargetToKind(
  target: ExecutionTarget
): SandboxRuntimeKind {
  if (target === "cloud") return cloudSandboxKindFromEnv();
  return "host";
}

export function rememberSessionExecutionTarget(
  sessionId: string,
  target: ExecutionTarget
): void {
  sessionKindCache.set(sessionId, executionTargetToKind(target));
}

export function forgetSessionRuntimeKind(sessionId: string): void {
  sessionKindCache.delete(sessionId);
}

export function getSandboxRuntimeByKind(
  kind: SandboxRuntimeKind
): SandboxRuntime {
  let adapter = adapters.get(kind);
  if (adapter) return adapter;
  if (kind === "kubernetes") {
    adapter = createK8sSandboxRuntime();
  } else if (kind === "host") {
    adapter = createHostSandboxRuntime();
  } else {
    adapter = createDockerSandboxRuntime();
  }
  adapters.set(kind, adapter);
  return adapter;
}

export async function resolveSandboxRuntimeKindForSession(
  sessionId: string
): Promise<SandboxRuntimeKind> {
  const cached = sessionKindCache.get(sessionId);
  if (cached) return cached;
  const chat = await new ChatFeatureRepository().getBySessionId(sessionId);
  const kind = executionTargetToKind(chat?.executionTarget ?? "local");
  sessionKindCache.set(sessionId, kind);
  return kind;
}

export async function getSandboxRuntime(
  sessionId: string
): Promise<SandboxRuntime> {
  const kind = await resolveSandboxRuntimeKindForSession(sessionId);
  return getSandboxRuntimeByKind(kind);
}

export async function isHostSession(sessionId: string): Promise<boolean> {
  return (await resolveSandboxRuntimeKindForSession(sessionId)) === "host";
}

export function resetSandboxRuntimeCache(): void {
  adapters.clear();
  sessionKindCache.clear();
}
