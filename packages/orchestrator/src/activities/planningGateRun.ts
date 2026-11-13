import {
  PLAN_SSE_EVENTS,
  PLANNING_GATE_SYSTEM,
  planningGateShortcut,
  previewForTrace,
  resolvePlanningGate,
  type PlanningGateResult,
  type PlanningGateTrace
} from "@forge/core";
import { appendChunk, type StoredMessage } from "./chatApi.js";
import {
  DEFAULT_GATE_MAX_OUTPUT_TOKENS,
  callPlannerText
} from "./planInvoke.js";

const DEFAULT_EXCERPT_MESSAGES = 12;
const DEFAULT_EXCERPT_CHARS = 2500;

function logPlanningGate(event: string, fields: Record<string, unknown>): void {
  console.info(`[planningGate] ${event}`, fields);
}

async function publishPlanningGateTrace(opts: {
  turnId: string;
  result: PlanningGateResult;
}): Promise<void> {
  try {
    await appendChunk({
      turnId: opts.turnId,
      eventType: PLAN_SSE_EVENTS.planningGate,
      payload: {
        needsPlanning: opts.result.needsPlanning,
        reason: opts.result.reason,
        ...(opts.result.trace ? { trace: opts.result.trace } : {})
      }
    });
  } catch (err) {
    logPlanningGate("publish_trace_failed", {
      turnId: opts.turnId,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

async function completePlanningGateLlm(opts: {
  input: {
    turnId: string;
    userText: string;
    provider: string;
    model?: string;
  };
  mode: string;
  prompt: string;
}): Promise<PlanningGateResult> {
  const { input, mode, prompt } = opts;
  try {
    logPlanningGate("llm_start", {
      turnId: input.turnId,
      provider: input.provider,
      model: input.model ?? null,
      maxOutputTokens: DEFAULT_GATE_MAX_OUTPUT_TOKENS,
      promptPreview: previewForTrace(prompt)
    });
    const text = await callPlannerText({
      system: PLANNING_GATE_SYSTEM,
      prompt,
      provider: input.provider,
      model: input.model,
      maxOutputTokens: DEFAULT_GATE_MAX_OUTPUT_TOKENS,
      detail: "planningGate"
    });
    const parsed = resolvePlanningGate({
      userText: input.userText,
      mode,
      llmRaw: text
    });
    const trace: PlanningGateTrace = {
      source: "llm",
      provider: input.provider,
      model: input.model,
      maxOutputTokens: DEFAULT_GATE_MAX_OUTPUT_TOKENS,
      promptPreview: previewForTrace(prompt),
      llmRawPreview: previewForTrace(text ?? ""),
      llmRawChars: (text ?? "").length
    };
    const result: PlanningGateResult = { ...parsed, trace };
    logPlanningGate("llm_done", {
      turnId: input.turnId,
      needsPlanning: result.needsPlanning,
      reason: result.reason,
      llmRawChars: trace.llmRawChars,
      llmRawPreview: trace.llmRawPreview
    });
    await publishPlanningGateTrace({ turnId: input.turnId, result });
    return result;
  } catch (err) {
    const result: PlanningGateResult = {
      needsPlanning: false,
      reason: "gate_error",
      trace: {
        source: "gate_error",
        provider: input.provider,
        model: input.model,
        maxOutputTokens: DEFAULT_GATE_MAX_OUTPUT_TOKENS,
        promptPreview: previewForTrace(prompt),
        llmRawPreview: previewForTrace(
          err instanceof Error ? err.message : String(err)
        )
      }
    };
    logPlanningGate("llm_error", {
      turnId: input.turnId,
      error: err instanceof Error ? err.message : String(err)
    });
    await publishPlanningGateTrace({ turnId: input.turnId, result });
    return result;
  }
}

export async function runPlanningGate(input: {
  sessionId: string;
  turnId: string;
  userText: string;
  provider: string;
  model?: string;
  mode?: string;
}): Promise<PlanningGateResult> {
  const mode = input.mode ?? "agent";
  const prompt = `User request:\n${input.userText.trim()}\n\nMode: ${mode}`;
  const early = planningGateShortcut({
    userText: input.userText,
    mode
  });
  if (early) {
    const result: PlanningGateResult = {
      ...early,
      trace: {
        source: "shortcut",
        provider: input.provider,
        model: input.model,
        promptPreview: previewForTrace(prompt)
      }
    };
    logPlanningGate("shortcut", {
      turnId: input.turnId,
      needsPlanning: result.needsPlanning,
      reason: result.reason
    });
    await publishPlanningGateTrace({ turnId: input.turnId, result });
    return result;
  }
  return completePlanningGateLlm({ input, mode, prompt });
}

function textFromParts(parts: unknown[]): string {
  const chunks: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const row = part as { type?: unknown; text?: unknown };
    if (
      row.type === "text" &&
      typeof row.text === "string" &&
      row.text.trim()
    ) {
      chunks.push(row.text.trim());
    }
  }
  return chunks.join(" ").trim();
}

export function formatPlannerChatExcerpt(
  messages: StoredMessage[],
  opts?: { maxMessages?: number; maxChars?: number }
): string {
  const maxMessages = opts?.maxMessages ?? DEFAULT_EXCERPT_MESSAGES;
  const maxChars = opts?.maxChars ?? DEFAULT_EXCERPT_CHARS;
  const lines: string[] = [];
  for (const msg of messages.slice(-maxMessages)) {
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    const text = textFromParts(msg.parts);
    if (!text) continue;
    lines.push(`${msg.role}: ${text}`);
  }
  const joined = lines.join("\n");
  if (joined.length <= maxChars) return joined;
  return `…\n${joined.slice(joined.length - maxChars)}`;
}
