export type ChatAgentMode =
  | "agent"
  | "plan"
  | "debug"
  | "ask"
  | "multitask"
  | "auto"
  | "build";

export type InteractiveChatTurnArgs = {
  sessionId: string;
  turnId: string;
  userText: string;
  mode: ChatAgentMode;
  provider: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
};

export type InteractiveChatTurnResult = {
  sessionId: string;
  turnId: string;
  status: "completed" | "failed" | "cancelled";
  mode: ChatAgentMode;
  provider: string;
  model?: string;
  rounds: number;
  toolCallCount: number;
  toolNames: string[];
  finalTextPreview: string;
  error?: string;
};

const FINAL_TEXT_PREVIEW_CHARS = 500;
const N_8 = 8;

export function isLocalChatProvider(provider: string): boolean {
  const p = provider.trim().toLowerCase();
  return p === "openai-compatible" || p === "custom" || p === "ollama";
}

export function failureMessage(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < N_8 && cur; i++) {
    if (cur instanceof Error) {
      if (cur.message) parts.push(cur.message);
      cur = cur.cause;
      continue;
    }
    if (typeof cur === "object" && cur !== null && "message" in cur) {
      const msg = (
        cur as {
          message?: unknown;
        }
      ).message;
      if (typeof msg === "string" && msg) parts.push(msg);
      cur =
        "cause" in cur
          ? (
              cur as {
                cause?: unknown;
              }
            ).cause
          : undefined;
      continue;
    }
    break;
  }
  return parts[parts.length - 1] || String(err);
}

export function previewText(text: string): string {
  const t = text.trim();
  if (t.length <= FINAL_TEXT_PREVIEW_CHARS) return t;
  return `${t.slice(0, FINAL_TEXT_PREVIEW_CHARS)}…`;
}

export function buildResult(
  args: InteractiveChatTurnArgs,
  partial: {
    status: InteractiveChatTurnResult["status"];
    rounds: number;
    toolNames: string[];
    toolCallCount: number;
    finalText: string;
    error?: string;
  }
): InteractiveChatTurnResult {
  return {
    sessionId: args.sessionId,
    turnId: args.turnId,
    status: partial.status,
    mode: args.mode,
    provider: args.provider,
    ...(args.model ? { model: args.model } : {}),
    rounds: partial.rounds,
    toolCallCount: partial.toolCallCount,
    toolNames: partial.toolNames,
    finalTextPreview: previewText(partial.finalText),
    ...(partial.error ? { error: partial.error } : {})
  };
}

export function parseAppliedMode(
  metadata: Record<string, unknown> | undefined
): ChatAgentMode | null {
  const raw = metadata?.mode;
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (
    v === "agent" ||
    v === "plan" ||
    v === "debug" ||
    v === "ask" ||
    v === "multitask" ||
    v === "auto"
  ) {
    return v;
  }
  if (v === "build") return "agent";
  return null;
}
