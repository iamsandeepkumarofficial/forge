import type { ChatLlmProvider } from "./modelContextWindow.js";

const N_400 = 400;

const ANTHROPIC_MODEL_FALLBACK_LIST = [
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-latest",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-latest",
  "claude-3-opus-latest"
];

export type ModelsListBody = {
  object: string;
  data: Array<{
    id: string;
    object?: string;
  }>;
  error?: string;
};

function normalizeOpenAICompatibleV1Base(raw: string): string {
  const trimmed = raw.replace(/\/$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

async function fetchOpenAiCompatibleModels(options: {
  baseUrl: string;
  apiKey?: string;
  errorPrefix: string;
}): Promise<ModelsListBody> {
  const base = normalizeOpenAICompatibleV1Base(options.baseUrl);
  const headers: HeadersInit = {};
  if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;
  const res = await fetch(`${base}/models`, { headers });
  if (!res.ok) {
    const t = await res.text();
    return {
      object: "list",
      data: [],
      error: `${options.errorPrefix} ${res.status}: ${t.slice(0, N_400)}`
    };
  }
  return (await res.json()) as ModelsListBody;
}

async function listOpenAiCompatibleModels(): Promise<ModelsListBody> {
  const rawBase = firstEnv(
    "OPENAI_COMPATIBLE_BASE_URL",
    "CUSTOM_BASE_URL",
    "SDLC_LLM_BASE_URL",
    "OLLAMA_BASE_URL"
  );
  if (!rawBase) {
    return {
      object: "list",
      data: [],
      error:
        "OPENAI_COMPATIBLE_BASE_URL is not set (also accepts CUSTOM_BASE_URL / SDLC_LLM_BASE_URL)"
    };
  }
  return fetchOpenAiCompatibleModels({
    baseUrl: rawBase,
    apiKey: firstEnv(
      "OPENAI_COMPATIBLE_API_KEY",
      "CUSTOM_API_KEY",
      "SDLC_LLM_API_KEY",
      "OLLAMA_API_KEY"
    ),
    errorPrefix: "OpenAI-compatible /models"
  });
}

async function listOpenAiModels(): Promise<ModelsListBody> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { object: "list", data: [], error: "OPENAI_API_KEY is not set" };
  }
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` }
  });
  if (!res.ok) {
    const t = await res.text();
    return {
      object: "list",
      data: [],
      error: `OpenAI /models ${res.status}: ${t.slice(0, N_400)}`
    };
  }
  return (await res.json()) as ModelsListBody;
}

export async function listModelsForProvider(
  provider: ChatLlmProvider
): Promise<ModelsListBody> {
  if (provider === "anthropic") {
    return {
      object: "list",
      data: ANTHROPIC_MODEL_FALLBACK_LIST.map((id) => ({ id, object: "model" }))
    };
  }
  if (provider === "openai-compatible") return listOpenAiCompatibleModels();
  return listOpenAiModels();
}
