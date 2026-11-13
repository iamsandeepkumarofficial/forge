import {
  isLengthFinishReason,
  truncatedToolCallOutput
} from "./chatTurnLimits.js";
import {
  parseAppliedMode,
  type ChatAgentMode,
  type InteractiveChatTurnArgs
} from "./chatTurnHelpers.js";
import type {
  LlmActs,
  LoopMessage,
  ShortActs,
  ToolActs,
  ToolCallLike
} from "./reactLoopRun.js";

export async function appendLoopUserMessage(opts: {
  quiet: boolean;
  short: ShortActs;
  args: InteractiveChatTurnArgs;
  messages: LoopMessage[];
  id: string;
  text: string;
}): Promise<LoopMessage[]> {
  if (opts.quiet) {
    return [
      ...opts.messages,
      {
        id: opts.id,
        role: "user",
        parts: [{ type: "text", text: opts.text }]
      }
    ];
  }
  await opts.short.appendChatMessage({
    sessionId: opts.args.sessionId,
    role: "user",
    parts: [{ type: "text", text: opts.text }],
    turnId: opts.args.turnId
  });
  return opts.short.loadChatMessages(opts.args.sessionId);
}

export function assistantPartsForStep(opts: {
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
  messages?: LoopMessage[];
}): Promise<void> {
  const parts = assistantPartsForStep({
    reasoningText: opts.reasoningText,
    text: opts.text,
    toolCalls: opts.toolCalls
  });
  if (opts.args.quiet) {
    opts.messages?.push({
      id: `quiet-assistant-${opts.toolCalls[0]?.toolCallId ?? "step"}`,
      role: "assistant",
      parts
    });
    return;
  }
  await opts.short.appendChatMessage({
    sessionId: opts.args.sessionId,
    role: "assistant",
    parts,
    turnId: opts.args.turnId
  });
}

async function appendToolResultParts(opts: {
  short: ShortActs;
  args: InteractiveChatTurnArgs;
  parts: unknown[];
  messages?: LoopMessage[];
}): Promise<void> {
  if (opts.args.quiet) {
    opts.messages?.push({
      id: `quiet-tool-${opts.messages.length}`,
      role: "tool",
      parts: opts.parts
    });
    return;
  }
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
      turnId: chunkTurnId(opts.args),
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      output,
      quiet: opts.args.quiet,
      streamTurnId: opts.args.streamTurnId
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

export function chunkTurnId(args: InteractiveChatTurnArgs): string {
  return args.streamTurnId ?? args.turnId;
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
  messages?: LoopMessage[];
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
      turnId: chunkTurnId(opts.args),
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      args: tc.args,
      agentMode: opts.currentMode.value,
      quiet: opts.args.quiet,
      streamTurnId: opts.args.streamTurnId
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
    parts: toolResultParts,
    messages: opts.messages
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
  messages?: LoopMessage[];
}): Promise<{ count: number; pauseForUserInput: boolean }> {
  await appendAssistantToolInvocations(opts);
  const toolResultParts: unknown[] = [];
  for (const tc of opts.toolCalls) {
    opts.toolNameSet.add(tc.toolName);
    const output = truncatedToolCallOutput(tc.toolName);
    await opts.short.rejectChatToolCall({
      turnId: chunkTurnId(opts.args),
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      output,
      quiet: opts.args.quiet,
      streamTurnId: opts.args.streamTurnId
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
    parts: toolResultParts,
    messages: opts.messages
  });
  return { count: opts.toolCalls.length, pauseForUserInput: false };
}

export async function applyToolStep(opts: {
  short: ShortActs;
  tools: ToolActs;
  args: InteractiveChatTurnArgs;
  text: string;
  reasoningText?: string;
  finishReason: string;
  toolCalls: ToolCallLike[];
  toolNameSet: Set<string>;
  currentMode: { value: ChatAgentMode };
  messages?: LoopMessage[];
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
  structuredOutput?: unknown;
};
