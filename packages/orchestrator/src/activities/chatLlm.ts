import { heartbeat } from "@temporalio/activity";
import {
  resolveChatLanguageModel,
  coerceChatProvider,
  type ChatLlmProvider
} from "../chatModel.js";
import { resolveChatAgentMode, type AgentMode } from "@forge/core";
import { buildChatTools } from "../tools.js";
import { buildModeAwareSystemPrompt } from "../chatModePrompt.js";
import {
  appendChunk,
  getChatSystemPrompt,
  type StoredMessage
} from "./chatApi.js";
import { streamLlmStepText } from "./chatLlmStream.js";

const N_6 = 6;
const N_50 = 50;
const N_64 = 64;
const N_800 = 800;

const ANTHROPIC_THINKING_BUDGET: Record<"low" | "medium" | "high", number> = {
  low: 2048,
  medium: 8192,
  high: 16000
};

export type ToolCallSpec = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
};

export type LlmStepResult = {
  text: string;
  reasoningText: string;
  toolCalls: ToolCallSpec[];
  finishReason: string;
  systemPrompt?: string;
  systemPromptChars?: number;
  structuredOutput?: unknown;
};

export function extractThoughtSignature(
  providerMetadata: unknown
): string | undefined {
  if (!providerMetadata || typeof providerMetadata !== "object")
    return undefined;
  for (const value of Object.values(
    providerMetadata as Record<string, unknown>
  )) {
    if (!value || typeof value !== "object") continue;
    const sig = (
      value as {
        thoughtSignature?: unknown;
      }
    ).thoughtSignature;
    if (typeof sig === "string" && sig.length > 0) return sig;
  }
  return undefined;
}

export function formatLlmCallError(err: unknown): string {
  const parts: string[] = [];
  const visit = (e: unknown, depth: number) => {
    if (!e || depth > N_6) return;
    if (typeof e === "object") {
      const o = e as Record<string, unknown>;
      if (typeof o.statusCode === "number")
        parts.push(`status=${o.statusCode}`);
      if (typeof o.message === "string" && o.message.trim())
        parts.push(o.message.trim());
      if (typeof o.responseBody === "string" && o.responseBody.trim()) {
        parts.push(o.responseBody.trim().slice(0, N_800));
      }
      if (Array.isArray(o.errors)) {
        for (const nested of o.errors) visit(nested, depth + 1);
      }
      if (o.cause) visit(o.cause, depth + 1);
      if (o.lastError) visit(o.lastError, depth + 1);
      return;
    }
    if (e instanceof Error && e.message.trim()) parts.push(e.message.trim());
  };
  visit(err, 0);
  const unique = [...new Set(parts.filter(Boolean))];
  return unique.length > 0 ? unique.join(" | ") : String(err);
}

export function resolveChatProvider(provider: string): ChatLlmProvider {
  return coerceChatProvider(provider);
}

export function buildPlanAwareSystemPrompt(
  baseSystem: string,
  mode: AgentMode | "plan" | "build"
): string {
  return buildModeAwareSystemPrompt(baseSystem, resolveChatAgentMode(mode));
}

export { buildModeAwareSystemPrompt };

export function buildLlmProviderOptions(opts: {
  provider: ChatLlmProvider;
  reasoningEffort?: "low" | "medium" | "high";
}):
  | {
      anthropic?: {
        thinking: {
          type: "enabled";
          budgetTokens: number;
        };
      };
      openai?: {
        reasoningEffort: "low" | "medium" | "high";
      };
    }
  | undefined {
  if (!opts.reasoningEffort) return undefined;
  if (opts.provider === "anthropic") {
    return {
      anthropic: {
        thinking: {
          type: "enabled",
          budgetTokens: ANTHROPIC_THINKING_BUDGET[opts.reasoningEffort]
        }
      }
    };
  }
  if (opts.provider === "openai") {
    return { openai: { reasoningEffort: opts.reasoningEffort } };
  }
  return undefined;
}

function toolsWithoutExecute(
  toolsWithExecute: ReturnType<typeof buildChatTools>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(toolsWithExecute).map(([name, t]) => {
      const copy = { ...(t as Record<string, unknown>) };
      delete copy.execute;
      return [name, copy];
    })
  );
}

export type StreamDeltaBatcher = {
  push: (chunk: string) => Promise<void>;
  flush: () => Promise<void>;
  fullText: () => string;
};

export function shouldSkipStreamChunks(opts: {
  quiet?: boolean;
  streamTurnId?: string;
}): boolean {
  return opts.quiet === true && !opts.streamTurnId;
}

export function createStreamDeltaBatcher(opts: {
  turnId: string;
  eventType: "text_delta" | "reasoning_delta";
  maxChars?: number;
  maxMs?: number;
  quiet?: boolean;
  streamTurnId?: string;
}): StreamDeltaBatcher {
  const maxChars = opts.maxChars ?? N_64;
  const maxMs = opts.maxMs ?? N_50;
  const skipChunks = shouldSkipStreamChunks(opts);
  let buffer = "";
  let all = "";
  let lastFlushAt = Date.now();
  const flush = async () => {
    if (!buffer) return;
    const text = buffer;
    buffer = "";
    lastFlushAt = Date.now();
    if (skipChunks) return;
    await appendChunk({
      turnId: opts.turnId,
      eventType: opts.eventType,
      payload: { text }
    });
  };
  return {
    push: async (chunk: string) => {
      if (!chunk) return;
      all += chunk;
      buffer += chunk;
      if (
        shouldFlushDeltaBatch({
          bufferLength: buffer.length,
          elapsedMs: Date.now() - lastFlushAt,
          maxChars,
          maxMs
        })
      ) {
        await flush();
      }
    },
    flush,
    fullText: () => all
  };
}

export function shouldFlushDeltaBatch(opts: {
  bufferLength: number;
  elapsedMs: number;
  maxChars?: number;
  maxMs?: number;
}): boolean {
  const maxChars = opts.maxChars ?? N_64;
  const maxMs = opts.maxMs ?? N_50;
  return opts.bufferLength >= maxChars || opts.elapsedMs >= maxMs;
}

export async function runLlmStep(input: {
  sessionId: string;
  turnId: string;
  mode: AgentMode | "plan" | "build";
  provider: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
  messages: StoredMessage[];
  outputSchema?: Record<string, unknown>;
  quiet?: boolean;
  streamTurnId?: string;
}): Promise<LlmStepResult> {
  const provider = resolveChatProvider(input.provider);
  const agentMode = resolveChatAgentMode(input.mode);
  const quiet = input.quiet === true;
  const streamTurnId = input.streamTurnId;
  const skipChunks = shouldSkipStreamChunks({ quiet, streamTurnId });
  const baseSystem = buildModeAwareSystemPrompt(
    await getChatSystemPrompt(input.sessionId),
    agentMode
  );
  heartbeat({
    phase: "system_prompt_ready",
    turnId: input.turnId,
    mode: agentMode,
    provider,
    model: input.model ?? null,
    systemPromptChars: baseSystem.length,
    systemPrompt: baseSystem,
    at: Date.now()
  });
  const model = await resolveChatLanguageModel(provider, input.model);
  const toolsForModel = toolsWithoutExecute(
    buildChatTools({
      sessionId: input.sessionId,
      mode: agentMode,
      turnId: input.turnId
    })
  );
  const providerOptions = buildLlmProviderOptions({
    provider,
    reasoningEffort: input.reasoningEffort
  });
  if (!skipChunks) {
    await appendChunk({
      turnId: input.turnId,
      eventType: "llm_start",
      payload: {
        provider,
        model: input.model ?? null,
        systemPromptChars: baseSystem.length,
        systemPrompt: baseSystem
      }
    });
  }
  const result = await streamLlmStepText({
    provider,
    model,
    baseSystem,
    messages: input.messages,
    toolsForModel,
    providerOptions,
    turnId: input.turnId,
    outputSchema: input.outputSchema,
    quiet,
    streamTurnId
  });
  return {
    text: result.text,
    reasoningText: result.reasoningText,
    toolCalls: result.toolCalls,
    finishReason: String(result.finishReason ?? "stop"),
    systemPromptChars: baseSystem.length,
    systemPrompt: baseSystem,
    ...(result.structuredOutput !== undefined
      ? { structuredOutput: result.structuredOutput }
      : {})
  };
}
