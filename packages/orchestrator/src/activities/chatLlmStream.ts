import { streamText, stepCountIs, Output, jsonSchema } from "ai";
import { cancellationSignal } from "@temporalio/activity";
import { taskSchemaToJsonSchema } from "@forge/core";
import type { ChatLlmProvider } from "../chatModel.js";
import type { resolveChatLanguageModel } from "../chatModel.js";
import { appendChunk, withHeartbeats, type StoredMessage } from "./chatApi.js";
import { partsToModelMessages } from "./chatMessages.js";
import {
  buildLlmProviderOptions,
  createStreamDeltaBatcher,
  extractThoughtSignature,
  formatLlmCallError,
  shouldSkipStreamChunks,
  type ToolCallSpec,
  type StreamDeltaBatcher
} from "./chatLlm.js";

const ANTHROPIC_MAX_OUTPUT_TOKENS = 8192;

async function consumeLlmFullStream(opts: {
  turnId: string;
  result: ReturnType<typeof streamText>;
  textBatch: StreamDeltaBatcher;
  reasoningBatch: StreamDeltaBatcher;
  toolCalls: ToolCallSpec[];
  quiet?: boolean;
  streamTurnId?: string;
}): Promise<unknown> {
  const skipChunks = shouldSkipStreamChunks(opts);
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
    if (!skipChunks) {
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
  }
  await opts.reasoningBatch.flush();
  await opts.textBatch.flush();
  const finishReason = await opts.result.finishReason;
  if (!skipChunks) {
    await appendChunk({
      turnId: opts.turnId,
      eventType: "llm_finish",
      payload: {
        finishReason,
        toolCallCount: opts.toolCalls.length
      }
    });
  }
  return finishReason;
}

async function runStreamedLlmCall(opts: {
  provider: ChatLlmProvider;
  model: Awaited<ReturnType<typeof resolveChatLanguageModel>>;
  baseSystem: string;
  messages: StoredMessage[];
  toolsForModel: Record<string, unknown>;
  providerOptions: ReturnType<typeof buildLlmProviderOptions>;
  turnId: string;
  outputSchema?: Record<string, unknown>;
  quiet?: boolean;
  streamTurnId?: string;
  textBatch: StreamDeltaBatcher;
  reasoningBatch: StreamDeltaBatcher;
  toolCalls: ToolCallSpec[];
}): Promise<{
  text: string;
  reasoningText: string;
  toolCalls: ToolCallSpec[];
  finishReason: unknown;
  structuredOutput?: unknown;
}> {
  const llmSchema =
    opts.outputSchema && opts.outputSchema.type === "object"
      ? taskSchemaToJsonSchema(opts.outputSchema)
      : null;
  const structured = llmSchema
    ? { output: Output.object({ schema: jsonSchema(llmSchema) }) }
    : {};
  const result = streamText({
    model: opts.model,
    system: opts.baseSystem,
    messages: partsToModelMessages(opts.messages),
    tools: opts.toolsForModel as Parameters<typeof streamText>[0]["tools"],
    stopWhen: stepCountIs(1),
    maxOutputTokens:
      opts.provider === "anthropic" ? ANTHROPIC_MAX_OUTPUT_TOKENS : undefined,
    providerOptions: opts.providerOptions,
    abortSignal: cancellationSignal(),
    ...structured
  });
  const finishReason = await consumeLlmFullStream({
    turnId: opts.turnId,
    result,
    textBatch: opts.textBatch,
    reasoningBatch: opts.reasoningBatch,
    toolCalls: opts.toolCalls,
    quiet: opts.quiet,
    streamTurnId: opts.streamTurnId
  });
  let structuredOutput: unknown;
  if (llmSchema && opts.toolCalls.length === 0) {
    try {
      structuredOutput = await Promise.resolve(
        (result as unknown as { output?: PromiseLike<unknown> }).output
      );
    } catch {
      structuredOutput = undefined;
    }
  }
  return {
    text: opts.textBatch.fullText().trim(),
    reasoningText: opts.reasoningBatch.fullText().trim(),
    toolCalls: opts.toolCalls,
    finishReason,
    ...(structuredOutput !== undefined ? { structuredOutput } : {})
  };
}

export async function streamLlmStepText(opts: {
  provider: ChatLlmProvider;
  model: Awaited<ReturnType<typeof resolveChatLanguageModel>>;
  baseSystem: string;
  messages: StoredMessage[];
  toolsForModel: Record<string, unknown>;
  providerOptions: ReturnType<typeof buildLlmProviderOptions>;
  turnId: string;
  outputSchema?: Record<string, unknown>;
  quiet?: boolean;
  streamTurnId?: string;
}): Promise<{
  text: string;
  reasoningText: string;
  toolCalls: ToolCallSpec[];
  finishReason: unknown;
  structuredOutput?: unknown;
}> {
  const textBatch = createStreamDeltaBatcher({
    turnId: opts.turnId,
    eventType: "text_delta",
    quiet: opts.quiet,
    streamTurnId: opts.streamTurnId
  });
  const reasoningBatch = createStreamDeltaBatcher({
    turnId: opts.turnId,
    eventType: "reasoning_delta",
    quiet: opts.quiet,
    streamTurnId: opts.streamTurnId
  });
  const toolCalls: ToolCallSpec[] = [];
  try {
    return await withHeartbeats({
      work: runStreamedLlmCall({
        ...opts,
        textBatch,
        reasoningBatch,
        toolCalls
      }),
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
