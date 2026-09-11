import { runnerUrl } from "./tool-runner.js";

const N_5 = 5;
const N_6 = 6;
const HTTP_CONFLICT = 409;

export type LlmProvider = "openai" | "anthropic" | "openai-compatible";
export const REASONING_CAPABLE_PROVIDERS: LlmProvider[] = [
  "anthropic",
  "openai"
];

export function coerceLlmProvider(raw: string | null | undefined): LlmProvider {
  const v = (raw || "").trim().toLowerCase();
  if (v === "openai" || v === "anthropic") return v;
  if (v === "openai-compatible" || v === "custom" || v === "ollama") {
    return "openai-compatible";
  }
  return "openai-compatible";
}
export interface ModelListResponse {
  object?: string;
  data?: Array<{
    id: string;
    object?: string;
  }>;
  error?: string;
}
export type ChatMode =
  "agent" | "plan" | "debug" | "ask" | "multitask" | "auto";
export type ReasoningEffort = "low" | "medium" | "high";
export type UiChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  parts: Array<Record<string, unknown>>;
  createdAt?: string;
};
function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json"
  };
}
export async function fetchModels(provider: LlmProvider): Promise<string[]> {
  const res = await fetch(
    `${runnerUrl()}/api/models?provider=${encodeURIComponent(provider)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch models: ${res.status}`);
  }
  const body: ModelListResponse = await res.json();
  if (body.error && (!body.data || body.data.length === 0)) {
    throw new Error(body.error);
  }
  return Array.isArray(body.data) ? body.data.map((m) => m.id) : [];
}
export type ModelTokenLimits = {
  contextWindow: number | null;
  maxOutputTokens: number | null;
};

function positiveTokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export async function fetchModelTokenLimits(
  provider: LlmProvider,
  model: string
): Promise<ModelTokenLimits> {
  const empty: ModelTokenLimits = {
    contextWindow: null,
    maxOutputTokens: null
  };
  const res = await fetch(
    `${runnerUrl()}/api/models/context-window?provider=${encodeURIComponent(provider)}&model=${encodeURIComponent(model)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) return empty;
  const body = (await res.json()) as {
    contextWindow?: number | null;
    maxOutputTokens?: number | null;
  };
  return {
    contextWindow: positiveTokenCount(body.contextWindow),
    maxOutputTokens: positiveTokenCount(body.maxOutputTokens)
  };
}
export async function fetchModelContextWindow(
  provider: LlmProvider,
  model: string
): Promise<number | null> {
  return (await fetchModelTokenLimits(provider, model)).contextWindow;
}
export async function fetchSessionMessages(
  sessionId: string
): Promise<UiChatMessage[]> {
  const res = await fetch(
    `${runnerUrl()}/api/sessions/${encodeURIComponent(sessionId)}/messages`,
    { headers: authHeaders() }
  );
  if (!res.ok) {
    throw new Error(`Failed to load messages: ${res.status}`);
  }
  const body = (await res.json()) as {
    messages?: UiChatMessage[];
  };
  return Array.isArray(body.messages) ? body.messages : [];
}
export async function fetchRunningTurn(
  sessionId: string
): Promise<{ id: string; workflowId: string; status: string } | null> {
  const res = await fetch(
    `${runnerUrl()}/api/sessions/${encodeURIComponent(sessionId)}/turns/running`,
    { headers: authHeaders() }
  );
  if (!res.ok) {
    throw new Error(`Failed to load running turn: ${res.status}`);
  }
  const body = (await res.json()) as {
    turn?: { id: string; workflowId: string; status: string } | null;
  };
  return body.turn ?? null;
}

export async function startChatTurn(
  sessionId: string,
  input: {
    text: string;
    provider: LlmProvider;
    model?: string;
    mode: ChatMode;
    reasoningEffort?: ReasoningEffort;
  }
): Promise<{
  turnId: string;
  workflowId: string;
  streamUrl: string;
}> {
  const res = await fetch(
    `${runnerUrl()}/api/sessions/${encodeURIComponent(sessionId)}/chat`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(input)
    }
  );
  const body = (await res.json()) as {
    turnId?: string;
    workflowId?: string;
    streamUrl?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error || `chat start failed: ${res.status}`);
  }
  if (!body.turnId || !body.streamUrl) {
    throw new Error("chat start response missing turnId/streamUrl");
  }
  return {
    turnId: body.turnId,
    workflowId: body.workflowId ?? "",
    streamUrl: body.streamUrl
  };
}
export async function cancelChatTurn(
  sessionId: string,
  turnId: string
): Promise<void> {
  const res = await fetch(
    `${runnerUrl()}/api/sessions/${encodeURIComponent(sessionId)}/turns/${encodeURIComponent(turnId)}/cancel`,
    { method: "POST", headers: authHeaders() }
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error || `cancel failed: ${res.status}`);
  }
}

export async function deleteSessionMessagesFrom(
  sessionId: string,
  messageId: string
): Promise<void> {
  const res = await fetch(
    `${runnerUrl()}/api/sessions/${encodeURIComponent(sessionId)}/messages/from/${encodeURIComponent(messageId)}`,
    { method: "DELETE", headers: authHeaders() }
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error || `delete messages failed: ${res.status}`);
  }
}

export async function copySessionMessagesUntil(options: {
  sourceSessionId: string;
  targetSessionId: string;
  untilMessageId: string;
}): Promise<void> {
  const res = await fetch(
    `${runnerUrl()}/api/sessions/${encodeURIComponent(options.sourceSessionId)}/branch`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        untilMessageId: options.untilMessageId,
        targetSessionId: options.targetSessionId
      })
    }
  );
  if (res.status === HTTP_CONFLICT) return;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error || `branch copy failed: ${res.status}`);
  }
}

export type StreamHandlers = {
  onEvent: (event: {
    eventType: string;
    payload: Record<string, unknown>;
    seq: number;
  }) => void;
  onError?: (err: Error) => void;
  onDone?: () => void;
};
export async function consumeTurnStream(options: {
  streamUrl: string;
  handlers: StreamHandlers;
  signal?: AbortSignal;
}): Promise<void> {
  const { streamUrl, handlers, signal } = options;
  const url = streamUrl.startsWith("http")
    ? streamUrl
    : `${runnerUrl()}${streamUrl}`;
  const res = await fetch(url, {
    headers: {
      Accept: "text/event-stream",
      ...authHeaders()
    },
    signal
  });
  if (!res.ok || !res.body) {
    throw new Error(`stream failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "message";
  let eventId = "0";
  let dataLines: string[] = [];
  const flush = () => {
    if (dataLines.length === 0) return;
    const raw = dataLines.join("\n");
    dataLines = [];
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      payload = { raw };
    }
    const seq = Number(eventId) || 0;
    handlers.onEvent({
      eventType: eventType || "message",
      payload,
      seq
    });
    eventType = "message";
    eventId = "0";
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line === "") {
        flush();
        continue;
      }
      if (line.startsWith("id:")) {
        eventId = line.slice(3).trim();
      } else if (line.startsWith("event:")) {
        eventType = line.slice(N_6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(N_5).trimStart());
      }
    }
  }
  flush();
  handlers.onDone?.();
}
