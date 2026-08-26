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

type ForgeConfigFile = {
  llm?: ForgeLlmConfig;
};

function forgeConfigPath(): string {
  return path.join(os.homedir(), ".forge", "config.json");
}

export async function readForgeLlmConfig(): Promise<ForgeLlmConfig> {
  try {
    const raw = await fs.readFile(forgeConfigPath(), "utf8");
    const cfg = JSON.parse(raw) as ForgeConfigFile;
    return cfg.llm ?? {};
  } catch {
    return {};
  }
}
