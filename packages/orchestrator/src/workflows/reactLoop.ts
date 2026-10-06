import type * as activities from "../activities/index.js";
import {
  isLengthFinishReason,
  MAX_TOOL_ROUNDS,
  roundCapNotice,
  truncatedToolCallOutput
} from "./chatTurnLimits.js";
import {
  parseAppliedMode,
  type ChatAgentMode,
  type InteractiveChatTurnArgs
} from "./chatTurnHelpers.js";

type ShortActs = {
  loadChatMessages: (typeof activities)["loadChatMessages"];
  appendChatMessage: (typeof activities)["appendChatMessage"];
  rejectChatToolCall: (typeof activities)["rejectChatToolCall"];
};
type LlmActs = {
  runLlmStep: (typeof activities)["runLlmStep"];
};
type ToolActs = {
  executeChatTool: (typeof activities)["executeChatTool"];
};

type ToolCallLike = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
};

function assistantPartsForStep(opts: {
  reasoningText?: string;
  text: string;
  toolCalls?: ToolCallLike[];
}): unknown[] {
  return [
    ...(opts.reasoningText
      ? [{ type: "reasoning", text: opts.reasoningText }]
      : []),
    ...(opts.text ? [{ type: "text", text: opts.text }] : []),
    ...(opts.toolCalls ?? []).map((tc) => ({
      type: "tool-invocation",
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      args: tc.args,
      state: "call",
      ...(tc.thoughtSignature ? { thoughtSignature: tc.thoughtSignature } : {})
    }))
  ];
}

async function appendAssistantToolInvocations(opts: {
  short: ShortActs;
  args: InteractiveChatTurnArgs;
  text: string;
  reasoningText?: string;
  toolCalls: ToolCallLike[];
}): Promise<void> {
  await opts.short.appendChatMessage({
    sessionId: opts.args.sessionId,
    role: "assistant",
    parts: assistantPartsForStep({
      reasoningText: opts.reasoningText,
      text: opts.text,
      toolCalls: opts.toolCalls
    }),
    turnId: opts.args.turnId
  });
}

async function appendToolResultParts(opts: {
  short: ShortActs;
  args: InteractiveChatTurnArgs;
  parts: unknown[];
}): Promise<void> {
  await opts.short.appendChatMessage({
    sessionId: opts.args.sessionId,
    role: "tool",
    parts: opts.parts,
    turnId: opts.args.turnId
  });
}

async function skipRemainingTools(opts: {
  short: ShortActs;
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
    await opts.short.rejectChatToolCall({
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
  short: ShortActs;
  tools: ToolActs;
  args: InteractiveChatTurnArgs;
  text: string;
  reasoningText?: string;
  toolCalls: ToolCallLike[];
  toolNameSet: Set<string>;
  currentMode: { value: ChatAgentMode };
}): Promise<{ count: number; pauseForUserInput: boolean }> {
  await appendAssistantToolInvocations(opts);
  const toolResultParts: unknown[] = [];
  let pauseForUserInput = false;
  for (let i = 0; i < opts.toolCalls.length; i++) {
    const tc = opts.toolCalls[i]!;
    opts.toolNameSet.add(tc.toolName);
    if (pauseForUserInput) {
      await skipRemainingTools({
        short: opts.short,
        args: opts.args,
        toolCalls: opts.toolCalls,
        startIndex: i,
        toolNameSet: opts.toolNameSet,
        toolResultParts
      });
      break;
    }
    const result = await opts.tools.executeChatTool({
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
        pauseForUserInput = true;
      }
    } else if (tc.toolName === "ask_user") {
      const meta = result.metadata as Record<string, unknown> | undefined;
      if (meta?.needsUserInput === true) {
        pauseForUserInput = true;
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
  await appendToolResultParts({
    short: opts.short,
    args: opts.args,
    parts: toolResultParts
  });
  return { count: opts.toolCalls.length, pauseForUserInput };
}

async function rejectTruncatedToolCalls(opts: {
  short: ShortActs;
  args: InteractiveChatTurnArgs;
  text: string;
  reasoningText?: string;
  toolCalls: ToolCallLike[];
  toolNameSet: Set<string>;
}): Promise<{ count: number; pauseForUserInput: boolean }> {
  await appendAssistantToolInvocations(opts);
  const toolResultParts: unknown[] = [];
  for (const tc of opts.toolCalls) {
    opts.toolNameSet.add(tc.toolName);
    const output = truncatedToolCallOutput(tc.toolName);
    await opts.short.rejectChatToolCall({
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
  await appendToolResultParts({
    short: opts.short,
    args: opts.args,
    parts: toolResultParts
  });
  return { count: opts.toolCalls.length, pauseForUserInput: false };
}

async function applyToolStep(opts: {
  short: ShortActs;
  tools: ToolActs;
  args: InteractiveChatTurnArgs;
  text: string;
  reasoningText?: string;
  finishReason: string;
  toolCalls: ToolCallLike[];
  toolNameSet: Set<string>;
  currentMode: { value: ChatAgentMode };
}): Promise<{ count: number; pauseForUserInput: boolean }> {
  if (isLengthFinishReason(opts.finishReason)) {
    return rejectTruncatedToolCalls(opts);
  }
  return runToolCallsRound(opts);
}

export type ReactLoopDeps = {
  short: ShortActs;
  llm: LlmActs;
  tools: ToolActs;
};

export type ReactLoopResult = {
  rounds: number;
  finalText: string;
  finalReasoningText: string;
  toolCallCount: number;
  pauseForUserInput: boolean;
};

export async function runToolRoundLoop(opts: {
  deps: ReactLoopDeps;
  args: InteractiveChatTurnArgs;
  currentMode: { value: ChatAgentMode };
  toolNameSet: Set<string>;
  maxRounds?: number;
}): Promise<ReactLoopResult> {
  const maxRounds = opts.maxRounds ?? MAX_TOOL_ROUNDS;
  let rounds = 0;
  let finalText = "";
  let finalReasoningText = "";
  let toolCallCount = 0;
  let pendingToolsAtCap = false;
  let pauseForUserInput = false;
  let messages = await opts.deps.short.loadChatMessages(opts.args.sessionId);
  while (rounds < maxRounds) {
    rounds += 1;
    const step = await opts.deps.llm.runLlmStep({
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
    if (step.reasoningText) {
      finalReasoningText = step.reasoningText;
    }
    if (!step.toolCalls.length) {
      pendingToolsAtCap = false;
      break;
    }
    finalReasoningText = "";
    pendingToolsAtCap = true;
    const applied = await applyToolStep({
      short: opts.deps.short,
      tools: opts.deps.tools,
      args: opts.args,
      text: step.text,
      reasoningText: step.reasoningText,
      finishReason: step.finishReason,
      toolCalls: step.toolCalls,
      toolNameSet: opts.toolNameSet,
      currentMode: opts.currentMode
    });
    toolCallCount += applied.count;
    if (applied.pauseForUserInput) {
      pendingToolsAtCap = false;
      pauseForUserInput = true;
      break;
    }
    messages = await opts.deps.short.loadChatMessages(opts.args.sessionId);
  }
  if (pendingToolsAtCap && rounds >= maxRounds) {
    finalText = [finalText.trim(), roundCapNotice(maxRounds)]
      .filter(Boolean)
      .join("\n\n");
  }
  return {
    rounds,
    finalText,
    finalReasoningText,
    toolCallCount,
    pauseForUserInput
  };
}

export { assistantPartsForStep };
