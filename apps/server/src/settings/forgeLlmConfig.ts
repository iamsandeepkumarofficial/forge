import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type ForgeLlmConfig = {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
};

export type ForgeConfigFile = {
  llm?: ForgeLlmConfig;
  desktop?: { stopComposeOnQuit?: boolean };
  [key: string]: unknown;
};

function forgeConfigPath(): string {
  return path.join(os.homedir(), ".forge", "config.json");
}

export async function readForgeConfig(): Promise<ForgeConfigFile> {
  try {
    const raw = await fs.readFile(forgeConfigPath(), "utf8");
    return JSON.parse(raw) as ForgeConfigFile;
  } catch {
    return {};
  }
}

export async function readForgeLlmConfig(): Promise<ForgeLlmConfig> {
  const cfg = await readForgeConfig();
  return cfg.llm ?? {};
}

export async function writeForgeLlmConfig(
  llm: ForgeLlmConfig
): Promise<ForgeConfigFile> {
  const cfg = await readForgeConfig();
  const next: ForgeConfigFile = {
    ...cfg,
    llm: {
      ...(cfg.llm ?? {}),
      ...llm
    },
    desktop: cfg.desktop ?? { stopComposeOnQuit: true }
  };
  const filePath = forgeConfigPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}


export async function resolveOpenAiCompatibleRuntime(): Promise<{
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}> {
  const llm = await readForgeLlmConfig();
  const baseUrl =
    llm.baseUrl?.trim() ||
    firstEnv(
      "OPENAI_COMPATIBLE_BASE_URL",
      "CUSTOM_BASE_URL",
      "SDLC_LLM_BASE_URL",
      "OLLAMA_BASE_URL"
    );
  const apiKey =
    llm.apiKey?.trim() ||
    firstEnv(
      "OPENAI_COMPATIBLE_API_KEY",
      "CUSTOM_API_KEY",
      "SDLC_LLM_API_KEY",
      "OLLAMA_API_KEY"
    );
  const model =
    llm.model?.trim() ||
    firstEnv(
      "OPENAI_COMPATIBLE_MODEL",
      "CUSTOM_MODEL",
      "SDLC_LLM_MODEL",
      "OLLAMA_MODEL",
      "WORKFLOW_LLM_MODEL"
    );
  return { baseUrl, apiKey, model };
}

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}
