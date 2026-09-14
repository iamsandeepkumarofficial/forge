import { streamText, stepCountIs } from "ai";
import { cancellationSignal, heartbeat } from "@temporalio/activity";
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
  withHeartbeats,
  type StoredMessage
} from "./chatApi.js";
import { partsToModelMessages } from "./chatMessages.js";

const N_6 = 6;
const N_50 = 50;
const N_64 = 64;
const N_800 = 800;
const N_8192 = 8192;

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

export function createStreamDeltaBatcher(opts: {
  turnId: string;
  eventType: "text_delta" | "reasoning_delta";
  maxChars?: number;
  maxMs?: number;
}): StreamDeltaBatcher {
  const maxChars = opts.maxChars ?? N_64;
  const maxMs = opts.maxMs ?? N_50;
  let buffer = "";
  let all = "";
  let lastFlushAt = Date.now();
  const flush = async () => {
    if (!buffer) return;
    const text = buffer;
    buffer = "";
    lastFlushAt = Date.now();
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

async function consumeLlmFullStream(opts: {
  turnId: string;
  result: ReturnType<typeof streamText>;
  textBatch: StreamDeltaBatcher;
  reasoningBatch: StreamDeltaBatcher;
  toolCalls: ToolCallSpec[];
}): Promise<unknown> {
  for await (const part of opts.result.fullStream) {
    if (part.type === "text-delta") {
      await opts.textBatch.push(part.text);
      continue;
    }
    if (part.type === "reasoning-delta") {
      await opts.reasoningBatch.push(part.text);
      continue;
    }
    if (part.type !== "tool-call") continue;
    await opts.reasoningBatch.flush();
    await opts.textBatch.flush();
    const thoughtSignature = extractThoughtSignature(part.providerMetadata);
    const tc: ToolCallSpec = {
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      args: (part.input ?? {}) as Record<string, unknown>,
      ...(thoughtSignature ? { thoughtSignature } : {})
    };
    opts.toolCalls.push(tc);
    await appendChunk({
      turnId: opts.turnId,
      eventType: "tool_call",
      payload: {
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: tc.args
      }
    });
  }
  await opts.reasoningBatch.flush();
  await opts.textBatch.flush();
  const finishReason = await opts.result.finishReason;
  await appendChunk({
    turnId: opts.turnId,
    eventType: "llm_finish",
    payload: {
      finishReason,
      toolCallCount: opts.toolCalls.length
    }
  });
  return finishReason;
}

async function streamLlmStepText(opts: {
  provider: ChatLlmProvider;
  model: Awaited<ReturnType<typeof resolveChatLanguageModel>>;
  baseSystem: string;
  messages: StoredMessage[];
  toolsForModel: Record<string, unknown>;
  providerOptions: ReturnType<typeof buildLlmProviderOptions>;
  turnId: string;
}): Promise<{
  text: string;
  reasoningText: string;
  toolCalls: ToolCallSpec[];
  finishReason: unknown;
}> {
  const textBatch = createStreamDeltaBatcher({
    turnId: opts.turnId,
    eventType: "text_delta"
  });
  const reasoningBatch = createStreamDeltaBatcher({
    turnId: opts.turnId,
    eventType: "reasoning_delta"
  });
  const toolCalls: ToolCallSpec[] = [];
  try {
    return await withHeartbeats({
      work: (async () => {
        const result = streamText({
          model: opts.model,
          system: opts.baseSystem,
          messages: partsToModelMessages(opts.messages),
          tools: opts.toolsForModel as Parameters<
            typeof streamText
          >[0]["tools"],
          stopWhen: stepCountIs(1),
          maxOutputTokens: opts.provider === "anthropic" ? N_8192 : undefined,
          providerOptions: opts.providerOptions,
          abortSignal: cancellationSignal()
        });
        const finishReason = await consumeLlmFullStream({
          turnId: opts.turnId,
          result,
          textBatch,
          reasoningBatch,
          toolCalls
        });
        return {
          text: textBatch.fullText().trim(),
          reasoningText: reasoningBatch.fullText().trim(),
          toolCalls,
          finishReason
        };
      })(),
      detail: {
        detail: `runLlmStep:${opts.turnId}`,
        systemPromptChars: opts.baseSystem.length,
        systemPrompt: opts.baseSystem
      }
    });
  } catch (err) {
    throw new Error(formatLlmCallError(err), { cause: err });
  }
}

export async function runLlmStep(input: {
  sessionId: string;
  turnId: string;
  mode: AgentMode | "plan" | "build";
  provider: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
  messages: StoredMessage[];
}): Promise<LlmStepResult> {
  const provider = resolveChatProvider(input.provider);
  const agentMode = resolveChatAgentMode(input.mode);
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
  const result = await streamLlmStepText({
    provider,
    model,
    baseSystem,
    messages: input.messages,
    toolsForModel,
    providerOptions,
    turnId: input.turnId
  });
  return {
    text: result.text,
    reasoningText: result.reasoningText,
    toolCalls: result.toolCalls,
    finishReason: String(result.finishReason ?? "stop"),
    systemPromptChars: baseSystem.length,
    systemPrompt: baseSystem
  };
}
