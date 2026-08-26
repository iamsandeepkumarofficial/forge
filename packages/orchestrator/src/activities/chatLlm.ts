import { generateText, stepCountIs } from "ai";
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
  withHeartbeats,
  type StoredMessage
} from "./chatApi.js";
import { partsToModelMessages, withFirstTurnRepoEval } from "./chatMessages.js";

const N_6 = 6;
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

function mapResultToolCalls(
  toolCalls: Array<{
    toolCallId: string;
    toolName: string;
    input?: unknown;
    providerMetadata?: unknown;
  }>
): ToolCallSpec[] {
  return toolCalls.map((tc) => {
    const thoughtSignature = extractThoughtSignature(tc.providerMetadata);
    return {
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      args: (tc.input ?? {}) as Record<string, unknown>,
      ...(thoughtSignature ? { thoughtSignature } : {})
    };
  });
}

async function emitLlmStepChunks(opts: {
  turnId: string;
  text: string;
  toolCalls: ToolCallSpec[];
  finishReason: unknown;
}): Promise<void> {
  if (opts.text) {
    await appendChunk({
      turnId: opts.turnId,
      eventType: "text_delta",
      payload: { text: opts.text }
    });
  }
  for (const tc of opts.toolCalls) {
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
  await appendChunk({
    turnId: opts.turnId,
    eventType: "llm_finish",
    payload: {
      finishReason: opts.finishReason,
      toolCallCount: opts.toolCalls.length
    }
  });
}

async function generateLlmStepText(opts: {
  provider: ChatLlmProvider;
  model: ReturnType<typeof resolveChatLanguageModel>;
  baseSystem: string;
  messages: StoredMessage[];
  toolsForModel: Record<string, unknown>;
  providerOptions: ReturnType<typeof buildLlmProviderOptions>;
  turnId: string;
}): Promise<{
  text?: string;
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    input?: unknown;
    providerMetadata?: unknown;
  }>;
  finishReason?: unknown;
}> {
  try {
    return await withHeartbeats({
      work: generateText({
        model: opts.model,
        system: opts.baseSystem,
        messages: partsToModelMessages(withFirstTurnRepoEval(opts.messages)),
        tools: opts.toolsForModel as Parameters<
          typeof generateText
        >[0]["tools"],
        stopWhen: stepCountIs(1),
        maxOutputTokens: opts.provider === "anthropic" ? N_8192 : undefined,
        providerOptions: opts.providerOptions
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
  const result = await generateLlmStepText({
    provider,
    model,
    baseSystem,
    messages: input.messages,
    toolsForModel,
    providerOptions,
    turnId: input.turnId
  });
  const text = result.text?.trim() ?? "";
  const toolCalls = mapResultToolCalls(
    (result.toolCalls ?? []) as Array<{
      toolCallId: string;
      toolName: string;
      input?: unknown;
      providerMetadata?: unknown;
    }>
  );
  await emitLlmStepChunks({
    turnId: input.turnId,
    text,
    toolCalls,
    finishReason: result.finishReason
  });
  return {
    text,
    toolCalls,
    finishReason: String(result.finishReason ?? "stop"),
    systemPromptChars: baseSystem.length,
    systemPrompt: baseSystem
  };
}
