import type { ForgeConfig } from "./types.js";
import { NATIVE_DATABASE_URL, NATIVE_TEMPORAL_PORT } from "./hostMode.js";

export function defaultConfig(): ForgeConfig {
  return {
    llm: { provider: null, model: null, apiKey: null },
    desktop: { stopComposeOnQuit: true }
  };
}

export function materializePreviewEnv(): Record<string, string> {
  return {
    PREVIEW_IN_PROCESS: "1",
    FORGE_PREVIEW_BASE_DOMAIN: "preview.localhost",
    PREVIEW_URL_SCHEME: "http",
    PREVIEW_PLANE_URL: "http://127.0.0.1:8081",
    PREVIEW_PUBLIC_ORIGIN: "http://127.0.0.1:8081"
  };
}

export function materializeHostRuntimeEnv(): Record<string, string> {
  return {
    FORGE_DESKTOP: "1",
    SANDBOX_RUNTIME: "host",
    DATABASE_URL: NATIVE_DATABASE_URL,
    TEMPORAL_ADDRESS: `127.0.0.1:${NATIVE_TEMPORAL_PORT}`,
    TEMPORAL_NAMESPACE: "default",
    TEMPORAL_TASK_QUEUE: "forge-orchestrator"
  };
}

export function materializeLlmEnv(config: ForgeConfig): Record<string, string> {
  const llm = config.llm;
  if (!llm) return {};
  return {
    ...fromNamedKeys(llm),
    ...fromGenericKey(llm),
    ...fromModelAndBase(llm)
  };
}

export function mergeEnvExtras(
  parts: readonly Record<string, string>[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of parts) {
    Object.assign(out, part);
  }
  return out;
}

function fromNamedKeys(
  llm: NonNullable<ForgeConfig["llm"]>
): Record<string, string> {
  const out: Record<string, string> = {};
  if (nonEmpty(llm.openaiApiKey)) out.OPENAI_API_KEY = llm.openaiApiKey;
  if (nonEmpty(llm.anthropicApiKey))
    out.ANTHROPIC_API_KEY = llm.anthropicApiKey;
  return out;
}

function fromGenericKey(
  llm: NonNullable<ForgeConfig["llm"]>
): Record<string, string> {
  if (!nonEmpty(llm.apiKey)) return {};
  const provider = (llm.provider ?? "openai-compatible").toLowerCase();
  if (provider === "anthropic") return { ANTHROPIC_API_KEY: llm.apiKey };
  if (provider === "openai") return { OPENAI_API_KEY: llm.apiKey };
  return { OPENAI_COMPATIBLE_API_KEY: llm.apiKey };
}

function fromModelAndBase(
  llm: NonNullable<ForgeConfig["llm"]>
): Record<string, string> {
  const out: Record<string, string> = {};
  if (nonEmpty(llm.model)) {
    out.OPENAI_COMPATIBLE_MODEL = llm.model;
    out.WORKFLOW_LLM_MODEL = llm.model;
  }
  if (nonEmpty(llm.baseUrl)) out.OPENAI_COMPATIBLE_BASE_URL = llm.baseUrl;
  return out;
}

function nonEmpty(value: string | null | undefined): value is string {
  return Boolean(value && value.length > 0);
}
