export type ChatLlmProvider = "openai" | "anthropic" | "openai-compatible";

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export type ModelTokenLimits = {
  contextWindow: number | null;
  maxOutputTokens: number | null;
};

const EMPTY_LIMITS: ModelTokenLimits = {
  contextWindow: null,
  maxOutputTokens: null
};
function normalizeOpenAICompatibleV1Base(raw: string): string {
  const trimmed = raw.replace(/\/$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}
function providerHostBase(raw: string): string {
  return raw.replace(/\/$/, "").replace(/\/v1$/i, "");
}
function pickNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0)
      return Math.round(v);
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
  }
  return null;
}
function contextFromRecord(
  row: Record<string, unknown> | null | undefined
): number | null {
  if (!row) return null;
  const direct = pickNumber(
    row.loaded_context_length,
    row.loadedContextLength,
    row.context_length,
    row.contextLength,
    row.max_context_length,
    row.maxContextLength,
    row.max_model_len,
    row.max_seq_len,
    (
      row.config as
        | {
            context_length?: unknown;
          }
        | undefined
    )?.context_length,
    (
      row.meta as
        | {
            n_ctx?: unknown;
          }
        | undefined
    )?.n_ctx
  );
  if (direct) return direct;
  for (const [key, value] of Object.entries(row)) {
    if (/context[_-]?length|num_ctx|max_context|max_model_len/i.test(key)) {
      const n = pickNumber(value);
      if (n) return n;
    }
  }
  return null;
}
function maxOutputFromRecord(
  row: Record<string, unknown> | null | undefined
): number | null {
  if (!row) return null;
  const nested = [
    row.top_provider,
    row.info,
    row.meta,
    row.architecture
  ].filter(
    (value): value is Record<string, unknown> =>
      !!value && typeof value === "object" && !Array.isArray(value)
  );
  const direct = pickNumber(
    row.max_completion_tokens,
    row.maxCompletionTokens,
    row.max_output_tokens,
    row.maxOutputTokens,
    row.max_output,
    row.num_predict,
    ...nested.flatMap((value) => [
      value.max_completion_tokens,
      value.maxCompletionTokens,
      value.max_output_tokens,
      value.maxOutputTokens,
      value.max_output,
      value.num_predict
    ])
  );
  if (direct) return direct;
  for (const [key, value] of Object.entries(row)) {
    if (/max[_-]?(completion|output)[_-]?tokens|^num_predict$/i.test(key)) {
      const n = pickNumber(value);
      if (n) return n;
    }
  }
  return null;
}
function limitsFromRecord(
  row: Record<string, unknown> | null | undefined
): ModelTokenLimits | null {
  const contextWindow = contextFromRecord(row);
  if (!contextWindow) return null;
  return {
    contextWindow,
    maxOutputTokens: maxOutputFromRecord(row)
  };
}
const OPENAI_CONTEXT: Array<{
  match: RegExp;
  tokens: number;
}> = [
  { match: /^gpt-4\.1|^gpt-4o|^chatgpt-4o/i, tokens: 128000 },
  { match: /^gpt-4-turbo|^gpt-4-0125|^gpt-4-1106/i, tokens: 128000 },
  { match: /^gpt-4-32k/i, tokens: 32768 },
  { match: /^gpt-4/i, tokens: 8192 },
  { match: /^gpt-3\.5-turbo-16k/i, tokens: 16385 },
  { match: /^gpt-3\.5/i, tokens: 16385 },
  { match: /^o1|^o3|^o4/i, tokens: 200000 },
  { match: /^text-embedding/i, tokens: 8192 }
];
const ANTHROPIC_CONTEXT: Array<{
  match: RegExp;
  tokens: number;
}> = [
  { match: /claude-opus-4|claude-sonnet-4|claude-4/i, tokens: 200000 },
  {
    match:
      /claude-3-7|claude-3-5|claude-3-opus|claude-3-sonnet|claude-3-haiku/i,
    tokens: 200000
  },
  { match: /claude-3/i, tokens: 200000 },
  { match: /claude-2\.1/i, tokens: 200000 },
  { match: /claude-2/i, tokens: 100000 }
];
function lookupTable(
  modelId: string,
  table: Array<{
    match: RegExp;
    tokens: number;
  }>
): number | null {
  for (const row of table) {
    if (row.match.test(modelId)) return row.tokens;
  }
  return null;
}
function authHeaders(apiKey: string | undefined): HeadersInit {
  const headers: HeadersInit = {};
  const ak = apiKey?.trim();
  if (ak) headers.Authorization = `Bearer ${ak}`;
  return headers;
}
function ollamaLimitsFromShowBody(body: {
  model_info?: Record<string, unknown>;
  details?: Record<string, unknown>;
  parameters?: string;
}): ModelTokenLimits | null {
  const params = body.parameters ?? "";
  const ctxMatch = params.match(/num_ctx\s+(\d+)/i);
  const predictMatch = params.match(/num_predict\s+(\d+)/i);
  const contextWindow =
    contextFromRecord(body.model_info) ??
    contextFromRecord(body.details) ??
    (ctxMatch ? Number(ctxMatch[1]) : null);
  if (!contextWindow) return null;
  return {
    contextWindow,
    maxOutputTokens:
      maxOutputFromRecord(body.model_info) ??
      maxOutputFromRecord(body.details) ??
      (predictMatch ? Number(predictMatch[1]) : null)
  };
}
async function ollamaShowLimits(options: {
  hostBase: string;
  modelId: string;
  apiKey?: string;
}): Promise<ModelTokenLimits | null> {
  const { hostBase, modelId, apiKey } = options;
  try {
    const res = await fetch(`${hostBase}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(apiKey) },
      body: JSON.stringify({ name: modelId })
    });
    if (!res.ok) return null;
    return ollamaLimitsFromShowBody(
      (await res.json()) as {
        model_info?: Record<string, unknown>;
        details?: Record<string, unknown>;
        parameters?: string;
      }
    );
  } catch {
    return null;
  }
}
async function lmStudioNativeLimits(options: {
  hostBase: string;
  modelId: string;
  apiKey?: string;
}): Promise<ModelTokenLimits | null> {
  const { hostBase, modelId, apiKey } = options;
  const headers = authHeaders(apiKey);
  const encodedId = encodeURIComponent(modelId);
  try {
    const single = await fetch(`${hostBase}/api/v0/models/${encodedId}`, {
      headers
    });
    if (single.ok) {
      const limits = limitsFromRecord(
        (await single.json()) as Record<string, unknown>
      );
      if (limits) return limits;
    }
  } catch {
    void 0;
  }
  try {
    const list = await fetch(`${hostBase}/api/v0/models`, { headers });
    if (!list.ok) return null;
    const body = (await list.json()) as {
      data?: Array<Record<string, unknown>>;
    };
    const rows = body.data ?? [];
    const row =
      rows.find((m) => String(m.id ?? "") === modelId) ??
      rows.find((m) => String(m.key ?? "") === modelId);
    return limitsFromRecord(row);
  } catch {
    return null;
  }
}
async function openAiCompatibleModelsLimits(options: {
  v1Base: string;
  modelId: string;
  apiKey?: string;
}): Promise<ModelTokenLimits | null> {
  const { v1Base, modelId, apiKey } = options;
  try {
    const res = await fetch(`${v1Base}/models`, {
      headers: authHeaders(apiKey)
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: Array<Record<string, unknown>>;
    };
    const row = (body.data ?? []).find((m) => String(m.id ?? "") === modelId);
    return limitsFromRecord(row);
  } catch {
    return null;
  }
}
async function resolveFromHost(options: {
  rawBase: string | undefined;
  modelId: string;
  apiKey?: string;
}): Promise<ModelTokenLimits | null> {
  const { rawBase, modelId, apiKey } = options;
  if (!rawBase?.trim()) return null;
  const host = providerHostBase(rawBase.trim());
  const v1 = normalizeOpenAICompatibleV1Base(rawBase.trim());
  return (
    (await lmStudioNativeLimits({ hostBase: host, modelId, apiKey })) ??
    (await openAiCompatibleModelsLimits({ v1Base: v1, modelId, apiKey })) ??
    (await ollamaShowLimits({ hostBase: host, modelId, apiKey }))
  );
}
function tableLimits(
  modelId: string,
  table: typeof OPENAI_CONTEXT
): ModelTokenLimits {
  return {
    contextWindow: lookupTable(modelId, table),
    maxOutputTokens: null
  };
}
export async function resolveModelTokenLimits(
  provider: ChatLlmProvider,
  modelId: string
): Promise<ModelTokenLimits> {
  const id = modelId.trim();
  if (!id) return EMPTY_LIMITS;
  if (provider === "openai") return tableLimits(id, OPENAI_CONTEXT);
  if (provider === "anthropic") return tableLimits(id, ANTHROPIC_CONTEXT);
  if (provider === "openai-compatible") {
    return (
      (await resolveFromHost({
        rawBase: firstEnv(
          "OPENAI_COMPATIBLE_BASE_URL",
          "CUSTOM_BASE_URL",
          "SDLC_LLM_BASE_URL",
          "OLLAMA_BASE_URL"
        ),
        modelId: id,
        apiKey: firstEnv(
          "OPENAI_COMPATIBLE_API_KEY",
          "CUSTOM_API_KEY",
          "SDLC_LLM_API_KEY",
          "OLLAMA_API_KEY"
        )
      })) ?? EMPTY_LIMITS
    );
  }
  return EMPTY_LIMITS;
}
export async function resolveModelContextWindow(
  provider: ChatLlmProvider,
  modelId: string
): Promise<number | null> {
  return (await resolveModelTokenLimits(provider, modelId)).contextWindow;
}
