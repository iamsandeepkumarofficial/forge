import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { AgentModel } from "@forge/agents";
import { env, type LlmProvider } from "./env.js";

export type ResolvedModelConfig = {
  provider: LlmProvider;
  name: string;
  baseUrl?: string;
  source: "agent" | "env" | "default";
};

export function normalizeOpenAICompatibleBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function defaultModelName(provider: LlmProvider): string {
  if (provider === "anthropic") return "claude-3-7-sonnet-latest";
  if (provider === "openai") return "gpt-4o-mini";
  return env.llmModel ?? "local-model";
}

export function resolveModelConfig(override?: AgentModel): ResolvedModelConfig {
  const provider: LlmProvider =
    (override?.provider as LlmProvider) || env.llmProvider;
  const hasAgentOverride = Boolean(
    override?.provider || override?.name || override?.baseUrl
  );
  const name = override?.name || env.llmModel || defaultModelName(provider);
  const baseUrl = override?.baseUrl || env.llmBaseUrl || undefined;
  return {
    provider,
    name,
    baseUrl,
    source: hasAgentOverride ? "agent" : env.llmModel ? "env" : "default"
  };
}

export function resolveModel(override?: AgentModel): LanguageModel {
  const config = resolveModelConfig(override);
  if (config.provider === "anthropic") {
    const key =
      process.env.ANTHROPIC_API_KEY?.trim() ||
      firstEnv("WORKFLOW_LLM_API_KEY", "SDLC_LLM_API_KEY");
    if (!key) {
      throw new Error(
        'ANTHROPIC_API_KEY (or WORKFLOW_LLM_API_KEY / SDLC_LLM_API_KEY) is required for provider "anthropic"'
      );
    }
    return createAnthropic({ apiKey: key })(config.name);
  }
  if (config.provider === "openai") {
    const key =
      process.env.OPENAI_API_KEY?.trim() ||
      firstEnv("WORKFLOW_LLM_API_KEY", "SDLC_LLM_API_KEY");
    if (!key) {
      throw new Error(
        'OPENAI_API_KEY (or WORKFLOW_LLM_API_KEY / SDLC_LLM_API_KEY) is required for provider "openai"'
      );
    }
    return createOpenAI({ apiKey: key })(config.name);
  }
  if (!config.baseUrl) {
    throw new Error(
      'OPENAI_COMPATIBLE_BASE_URL (or CUSTOM_BASE_URL / SDLC_LLM_BASE_URL / agent model.baseUrl) is required for provider "openai-compatible"'
    );
  }
  const client = createOpenAICompatible({
    name: "openai-compatible",
    baseURL: normalizeOpenAICompatibleBaseUrl(config.baseUrl),
    apiKey: env.llmApiKey || "not-needed",
    includeUsage: true
  });
  return client(config.name);
}

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function resolveLanguageModel(options: {
  provider: LlmProvider;
  modelId?: string;
  baseUrl?: string;
}): LanguageModel {
  return resolveModel({
    provider: options.provider,
    name: options.modelId,
    baseUrl: options.baseUrl
  });
}
