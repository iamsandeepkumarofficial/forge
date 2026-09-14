import fs from "node:fs";
import path from "node:path";
import type { ForgeConfig } from "./types.js";
import { NATIVE_DATABASE_URL, NATIVE_TEMPORAL_PORT } from "./hostMode.js";

const LLM_ENV_KEYS = [
  "OPENAI_COMPATIBLE_BASE_URL",
  "OPENAI_COMPATIBLE_API_KEY",
  "OPENAI_COMPATIBLE_MODEL",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "WORKFLOW_LLM_MODEL",
  "WORKFLOW_LLM_PROVIDER"
] as const;

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
    DATABASE_URL: NATIVE_DATABASE_URL,
    TEMPORAL_ADDRESS: `127.0.0.1:${NATIVE_TEMPORAL_PORT}`,
    TEMPORAL_NAMESPACE: "default",
    TEMPORAL_TASK_QUEUE: "forge-orchestrator"
  };
}

export function applyRepoEnvFile(
  root: string,
  env: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const loaded = parseEnvFile(path.join(root, ".env"));
  const applied: Record<string, string> = {};
  for (const key of LLM_ENV_KEYS) {
    const value = loaded[key]?.trim();
    if (!value) continue;
    if (env[key]?.trim()) continue;
    env[key] = value;
    applied[key] = value;
  }
  return applied;
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

export function parseEnvFile(filePath: string): Record<string, string> {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim();
    out[key] = unquoteEnvValue(rawValue);
  }
  return out;
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
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
  const apiKey = nonEmpty(llm.apiKey)
    ? llm.apiKey
    : process.env.OPENAI_COMPATIBLE_API_KEY?.trim();
  if (!nonEmpty(apiKey)) return {};
  const provider = (llm.provider ?? "openai-compatible").toLowerCase();
  if (provider === "anthropic") return { ANTHROPIC_API_KEY: apiKey };
  if (provider === "openai") return { OPENAI_API_KEY: apiKey };
  return { OPENAI_COMPATIBLE_API_KEY: apiKey };
}

function fromModelAndBase(
  llm: NonNullable<ForgeConfig["llm"]>
): Record<string, string> {
  const out: Record<string, string> = {};
  const model =
    (nonEmpty(llm.model) ? llm.model : undefined) ||
    process.env.OPENAI_COMPATIBLE_MODEL?.trim() ||
    process.env.WORKFLOW_LLM_MODEL?.trim();
  if (nonEmpty(model)) {
    out.OPENAI_COMPATIBLE_MODEL = model;
    out.WORKFLOW_LLM_MODEL = model;
  }
  const baseUrl =
    (nonEmpty(llm.baseUrl) ? llm.baseUrl : undefined) ||
    process.env.OPENAI_COMPATIBLE_BASE_URL?.trim();
  if (nonEmpty(baseUrl)) out.OPENAI_COMPATIBLE_BASE_URL = baseUrl;
  return out;
}

function nonEmpty(value: string | null | undefined): value is string {
  return Boolean(value && value.length > 0);
}
