import { proxyActivities, isCancellation } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";
import {
  isLengthFinishReason,
  MAX_TOOL_ROUNDS,
  roundCapNotice,
  truncatedToolCallOutput
} from "./chatTurnLimits.js";
import {
  buildResult,
  failureMessage,
  isLocalChatProvider,
  parseAppliedMode,
  type ChatAgentMode,
  type InteractiveChatTurnArgs,
  type InteractiveChatTurnResult
} from "./chatTurnHelpers.js";

export type {
  ChatAgentMode,
  InteractiveChatTurnArgs,
  InteractiveChatTurnResult
} from "./chatTurnHelpers.js";
export {
  buildResult,
  failureMessage,
  isLocalChatProvider,
  previewText
} from "./chatTurnHelpers.js";
export { MAX_TOOL_ROUNDS };

const short = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 5, initialInterval: "2s", backoffCoefficient: 2 }
});
const llmCloud = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  heartbeatTimeout: "2 minutes",
  retry: { maximumAttempts: 2, initialInterval: "5s" }
});
const llmLocal = proxyActivities<typeof activities>({
  startToCloseTimeout: "45 minutes",
  heartbeatTimeout: "5 minutes",
  retry: { maximumAttempts: 2, initialInterval: "5s" }
});
const tools = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  heartbeatTimeout: "5 minutes",
  retry: { maximumAttempts: 2, initialInterval: "5s" }
});

function llmActivities(provider: string) {
  return isLocalChatProvider(provider) ? llmLocal : llmCloud;
}

type ToolCallLike = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
};

async function appendAssistantToolInvocations(opts: {
  args: InteractiveChatTurnArgs;
  text: string;
  toolCalls: ToolCallLike[];
}): Promise<void> {
  await short.appendChatMessage({
    sessionId: opts.args.sessionId,
    role: "assistant",
    parts: [
      ...(opts.text ? [{ type: "text", text: opts.text }] : []),
      ...opts.toolCalls.map((tc) => ({
        type: "tool-invocation",
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: tc.args,
        state: "call",
        ...(tc.thoughtSignature
          ? { thoughtSignature: tc.thoughtSignature }
          : {})
      }))
    ],
    turnId: opts.args.turnId
  });
}

async function appendToolResultParts(opts: {
  args: InteractiveChatTurnArgs;
  parts: unknown[];
}): Promise<void> {
  await short.appendChatMessage({
    sessionId: opts.args.sessionId,
    role: "tool",
    parts: opts.parts,
    turnId: opts.args.turnId
  });
}

async function skipRemainingTools(opts: {
  args: InteractiveChatTurnArgs;
  toolCalls: ToolCallLike[];
  startIndex: number;
  toolNameSet: Set<string>;
  toolResultParts: unknown[];
}): Promise<void> {
  for (let i = opts.startIndex; i < opts.toolCalls.length; i++) {
    const tc = opts.toolCalls[i]!;
    opts.toolNameSet.add(tc.toolName);
    const output = "Skipped: waiting for the user to confirm the mode switch.";
    await short.rejectChatToolCall({
      turnId: opts.args.turnId,
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      output
    });
    opts.toolResultParts.push({
      type: "tool-result",
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      output,
      success: false
    });
  }
}

async function runToolCallsRound(opts: {
  args: InteractiveChatTurnArgs;
  text: string;
  toolCalls: ToolCallLike[];
  toolNameSet: Set<string>;
  currentMode: { value: ChatAgentMode };
}): Promise<{ count: number; pauseForModeConfirm: boolean }> {
  await appendAssistantToolInvocations(opts);
  const toolResultParts: unknown[] = [];
  let pauseForModeConfirm = false;
  for (let i = 0; i < opts.toolCalls.length; i++) {
    const tc = opts.toolCalls[i]!;
    opts.toolNameSet.add(tc.toolName);
    if (pauseForModeConfirm) {
      await skipRemainingTools({
        args: opts.args,
        toolCalls: opts.toolCalls,
        startIndex: i,
        toolNameSet: opts.toolNameSet,
        toolResultParts
      });
      break;
    }
    const result = await tools.executeChatTool({
      sessionId: opts.args.sessionId,
      turnId: opts.args.turnId,
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      args: tc.args,
      agentMode: opts.currentMode.value
    });
    if (tc.toolName === "switch_mode") {
      const meta = result.metadata as Record<string, unknown> | undefined;
      if (meta?.applied === true) {
        const next = parseAppliedMode(meta);
        if (next) opts.currentMode.value = next;
      } else if (meta?.needsConfirmation === true) {
        pauseForModeConfirm = true;
      }
    }
    toolResultParts.push({
      type: "tool-result",
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      output: result.output,
      success: result.success,
      ...(result.metadata ? { metadata: result.metadata } : {})
    });
  }
  await appendToolResultParts({ args: opts.args, parts: toolResultParts });
  return { count: opts.toolCalls.length, pauseForModeConfirm };
}

async function rejectTruncatedToolCalls(opts: {
  args: InteractiveChatTurnArgs;
  text: string;
  toolCalls: ToolCallLike[];
  toolNameSet: Set<string>;
}): Promise<{ count: number; pauseForModeConfirm: boolean }> {
  await appendAssistantToolInvocations(opts);
  const toolResultParts: unknown[] = [];
  for (const tc of opts.toolCalls) {
    opts.toolNameSet.add(tc.toolName);
    const output = truncatedToolCallOutput(tc.toolName);
    await short.rejectChatToolCall({
      turnId: opts.args.turnId,
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      output
    });
    toolResultParts.push({
      type: "tool-result",
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      output,
      success: false
    });
  }
  await appendToolResultParts({ args: opts.args, parts: toolResultParts });
  return { count: opts.toolCalls.length, pauseForModeConfirm: false };
}

async function handleTurnFailure(opts: {
  args: InteractiveChatTurnArgs;
  err: unknown;
  rounds: number;
  toolNameSet: Set<string>;
  toolCallCount: number;
  finalText: string;
}): Promise<InteractiveChatTurnResult> {
  if (isCancellation(opts.err)) {
    await short.finishChatTurn({
      turnId: opts.args.turnId,
      status: "cancelled"
    });
    return buildResult(opts.args, {
      status: "cancelled",
      rounds: opts.rounds,
      toolNames: [...opts.toolNameSet].sort(),
      toolCallCount: opts.toolCallCount,
      finalText: opts.finalText
    });
  }
  const message = failureMessage(opts.err);
  try {
    await short.finalizeChatTurn({
      sessionId: opts.args.sessionId,
      turnId: opts.args.turnId,
      assistantParts: [{ type: "text", text: `Error: ${message}` }],
      status: "failed",
      error: message
    });
  } catch {
    await short.finishChatTurn({
      turnId: opts.args.turnId,
      status: "failed",
      error: message
    });
  }
  throw opts.err;
}

async function applyToolStep(opts: {
  args: InteractiveChatTurnArgs;
  text: string;
  finishReason: string;
  toolCalls: ToolCallLike[];
  toolNameSet: Set<string>;
  currentMode: { value: ChatAgentMode };
}): Promise<{ count: number; pauseForModeConfirm: boolean }> {
  if (isLengthFinishReason(opts.finishReason)) {
    return rejectTruncatedToolCalls(opts);
  }
  return runToolCallsRound(opts);
}

async function runToolRoundLoop(opts: {
  args: InteractiveChatTurnArgs;
  currentMode: { value: ChatAgentMode };
  toolNameSet: Set<string>;
}): Promise<{ rounds: number; finalText: string; toolCallCount: number }> {
  let rounds = 0;
  let finalText = "";
  let toolCallCount = 0;
  let pendingToolsAtCap = false;
  let messages = await short.loadChatMessages(opts.args.sessionId);
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;
    const step = await llmActivities(opts.args.provider).runLlmStep({
      sessionId: opts.args.sessionId,
      turnId: opts.args.turnId,
      mode: opts.currentMode.value,
      provider: opts.args.provider,
      model: opts.args.model,
      reasoningEffort: opts.args.reasoningEffort,
      messages
    });
    if (step.text) {
      finalText = step.text;
    }
    if (!step.toolCalls.length) {
      pendingToolsAtCap = false;
      break;
    }
    pendingToolsAtCap = true;
    const applied = await applyToolStep({
      args: opts.args,
      text: step.text,
      finishReason: step.finishReason,
      toolCalls: step.toolCalls,
      toolNameSet: opts.toolNameSet,
      currentMode: opts.currentMode
    });
    toolCallCount += applied.count;
    if (applied.pauseForModeConfirm) {
      pendingToolsAtCap = false;
      break;
    }
    messages = await short.loadChatMessages(opts.args.sessionId);
  }
  if (pendingToolsAtCap && rounds >= MAX_TOOL_ROUNDS) {
    finalText = [finalText.trim(), roundCapNotice(MAX_TOOL_ROUNDS)]
      .filter(Boolean)
      .join("\n\n");
  }
  return { rounds, finalText, toolCallCount };
}

export async function interactiveChatTurnWorkflow(
  args: InteractiveChatTurnArgs
): Promise<InteractiveChatTurnResult> {
  const toolNameSet = new Set<string>();
  let rounds = 0;
  let finalText = "";
  let toolCallCount = 0;
  try {
    await short.ensureChatSandbox(args.sessionId);
    await short.appendChatMessage({
      sessionId: args.sessionId,
      role: "user",
      parts: [{ type: "text", text: args.userText }],
      turnId: args.turnId
    });
    const loop = await runToolRoundLoop({
      args,
      currentMode: { value: args.mode },
      toolNameSet
    });
    rounds = loop.rounds;
    finalText = loop.finalText;
    toolCallCount = loop.toolCallCount;
    await short.finalizeChatTurn({
      sessionId: args.sessionId,
      turnId: args.turnId,
      assistantParts: [{ type: "text", text: finalText || "_(no response)_" }],
      status: "completed"
    });
    return buildResult(args, {
      status: "completed",
      rounds,
      toolNames: [...toolNameSet].sort(),
      toolCallCount,
      finalText: finalText || "_(no response)_"
    });
  } catch (err) {
    return handleTurnFailure({
      args,
      err,
      rounds,
      toolNameSet,
      toolCallCount,
      finalText
    });
  }
}
