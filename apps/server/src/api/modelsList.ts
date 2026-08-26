import type { ChatLlmProvider } from "./modelContextWindow.js";
import { resolveOpenAiCompatibleRuntime } from "../settings/forgeLlmConfig.js";

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

function withConfiguredModel(
  body: ModelsListBody,
  model?: string
): ModelsListBody {
  const id = model?.trim();
  if (!id) return body;
  if (body.data.some((m) => m.id === id)) return body;
  return {
    ...body,
    data: [{ id, object: "model" }, ...body.data]
  };
}

async function listOpenAiCompatibleModels(): Promise<ModelsListBody> {
  const runtime = await resolveOpenAiCompatibleRuntime();
  if (!runtime.baseUrl) {
    return {
      object: "list",
      data: runtime.model
        ? [{ id: runtime.model, object: "model" }]
        : [],
      error:
        "Set an OpenAI-compatible base URL in Settings (or OPENAI_COMPATIBLE_BASE_URL in .env)"
    };
  }
  try {
    const listed = await fetchOpenAiCompatibleModels({
      baseUrl: runtime.baseUrl,
      apiKey: runtime.apiKey,
      errorPrefix: "OpenAI-compatible /models"
    });
    return withConfiguredModel(listed, runtime.model);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return withConfiguredModel(
      {
        object: "list",
        data: [],
        error: `OpenAI-compatible /models unreachable: ${message}`
      },
      runtime.model
    );
  }
}

async function listOpenAiModels(): Promise<ModelsListBody> {
  const { readForgeLlmConfig } = await import("../settings/forgeLlmConfig.js");
  const llm = await readForgeLlmConfig();
  const key = llm.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
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
