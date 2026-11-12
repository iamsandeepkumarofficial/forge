import type { AgentMode } from "@forge/core";
import { executeNamedTool } from "../tools.js";
import {
  appendChunk,
  appendChatMessage,
  finishChatTurn,
  withHeartbeats
} from "./chatApi.js";

const N_8000 = 8000;

export type { StoredMessage } from "./chatApi.js";
export type { LlmStepResult, ToolCallSpec } from "./chatLlm.js";

export type ChatTurnInput = {
  sessionId: string;
  turnId: string;
  userText: string;
  mode: AgentMode | "plan" | "build";
  provider: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
};

export {
  appendChatMessage,
  createTaskStreamTurn,
  ensureChatSandbox,
  finishChatTurn,
  getChatSystemPrompt,
  loadChatMessages,
  AGENT_TASK_STREAM_WORKFLOW_PREFIX
} from "./chatApi.js";

export { partsToModelMessages, sanitizeToolCallPairs } from "./chatMessages.js";

export {
  buildLlmProviderOptions,
  buildPlanAwareSystemPrompt,
  extractThoughtSignature,
  formatLlmCallError,
  resolveChatProvider,
  runLlmStep
} from "./chatLlm.js";

function shouldSkipChunks(input: {
  quiet?: boolean;
  streamTurnId?: string;
}): boolean {
  return input.quiet === true && !input.streamTurnId;
}

export async function rejectChatToolCall(input: {
  turnId: string;
  toolCallId: string;
  toolName: string;
  output: string;
  quiet?: boolean;
  streamTurnId?: string;
}): Promise<void> {
  if (shouldSkipChunks(input)) return;
  await appendChunk({
    turnId: input.turnId,
    eventType: "tool_start",
    payload: {
      toolCallId: input.toolCallId,
      toolName: input.toolName
    }
  });
  await appendChunk({
    turnId: input.turnId,
    eventType: "tool_result",
    payload: {
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      success: false,
      output: input.output.slice(0, N_8000)
    }
  });
}

export async function executeChatTool(input: {
  sessionId: string;
  turnId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  agentMode?: AgentMode | "plan" | "build" | null;
  quiet?: boolean;
  streamTurnId?: string;
}): Promise<{
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}> {
  const skipChunks = shouldSkipChunks(input);
  if (!skipChunks) {
    await appendChunk({
      turnId: input.turnId,
      eventType: "tool_start",
      payload: {
        toolCallId: input.toolCallId,
        toolName: input.toolName
      }
    });
  }
  const result = await withHeartbeats({
    work: executeNamedTool({
      sessionId: input.sessionId,
      toolName: input.toolName,
      args: input.args,
      turnId: input.turnId,
      agentMode: input.agentMode
    }),
    detail: `executeChatTool:${input.toolName}`
  });
  if (!skipChunks) {
    await appendChunk({
      turnId: input.turnId,
      eventType: "tool_result",
      payload: {
        toolCallId: input.toolCallId,
        toolName: input.toolName,
        success: result.success,
        output: result.output.slice(0, N_8000),
        ...(result.metadata ? { metadata: result.metadata } : {})
      }
    });
  }
  return {
    success: result.success,
    output: result.output,
    ...(result.metadata ? { metadata: result.metadata } : {})
  };
}

export async function finalizeChatTurn(input: {
  sessionId: string;
  turnId: string;
  assistantParts: unknown[];
  status?: "completed" | "failed";
  error?: string;
}): Promise<void> {
  if (input.assistantParts.length > 0) {
    await appendChatMessage({
      sessionId: input.sessionId,
      role: "assistant",
      parts: input.assistantParts,
      turnId: input.turnId
    });
  }
  await finishChatTurn({
    turnId: input.turnId,
    status: input.status ?? "completed",
    error: input.error
  });
  await appendChunk({
    turnId: input.turnId,
    eventType: "done",
    payload: {
      status: input.status ?? "completed",
      error: input.error ?? null
    }
  });
}
