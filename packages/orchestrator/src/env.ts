import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const packageRoot = path.resolve(here, "..");
config({ path: path.join(repoRoot, ".env") });
config({ path: path.join(packageRoot, ".env"), override: true });

export const REPO_ROOT = repoRoot;

export type LlmProvider = "anthropic" | "openai" | "openai-compatible";

export type SdlcLlmProvider = LlmProvider;

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function resolveProvider(raw: string | undefined): LlmProvider {
  const v = (raw || "").trim().toLowerCase();
  if (v === "anthropic") return "anthropic";
  if (v === "openai") return "openai";
  if (v === "custom" || v === "ollama") return "openai-compatible";
  return "openai-compatible";
}

export const env = {
  temporalAddress: process.env.TEMPORAL_ADDRESS || "localhost:7233",
  temporalNamespace: process.env.TEMPORAL_NAMESPACE || "default",
  taskQueue: process.env.TEMPORAL_TASK_QUEUE || "forge-orchestrator",
  toolRunnerUrl: (
    process.env.TOOL_RUNNER_URL || "http://127.0.0.1:4000"
  ).replace(/\/$/, ""),
  get llmProvider(): LlmProvider {
    return resolveProvider(
      firstEnv("WORKFLOW_LLM_PROVIDER", "SDLC_LLM_PROVIDER")
    );
  },
  get llmBaseUrl(): string | undefined {
    return firstEnv(
      "OPENAI_COMPATIBLE_BASE_URL",
      "CUSTOM_BASE_URL",
      "SDLC_LLM_BASE_URL",
      "OLLAMA_BASE_URL"
    );
  },
  get llmApiKey(): string | undefined {
    return firstEnv(
      "OPENAI_COMPATIBLE_API_KEY",
      "CUSTOM_API_KEY",
      "SDLC_LLM_API_KEY",
      "OLLAMA_API_KEY"
    );
  },
  get llmModel(): string | undefined {
    return firstEnv(
      "OPENAI_COMPATIBLE_MODEL",
      "CUSTOM_MODEL",
      "SDLC_LLM_MODEL",
      "OLLAMA_MODEL",
      "WORKFLOW_LLM_MODEL"
    );
  }
};
