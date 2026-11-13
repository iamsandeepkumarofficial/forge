import type * as activities from "../activities/index.js";
import { MAX_TOOL_ROUNDS, roundCapNotice } from "./chatTurnLimits.js";
import { tryParseJsonObject } from "./jsonText.js";
import {
  type ChatAgentMode,
  type InteractiveChatTurnArgs
} from "./chatTurnHelpers.js";
import {
  appendLoopUserMessage,
  applyToolStep,
  chunkTurnId,
  type ReactLoopDeps,
  type ReactLoopResult
} from "./reactLoopTools.js";
import { acceptStructuredOutput, schemaRepairText } from "./reactLoop.js";

const MAX_OUTPUT_REPAIRS = 2;

export type ShortActs = {
  loadChatMessages: (typeof activities)["loadChatMessages"];
  appendChatMessage: (typeof activities)["appendChatMessage"];
  rejectChatToolCall: (typeof activities)["rejectChatToolCall"];
};
export type LlmActs = {
  runLlmStep: (typeof activities)["runLlmStep"];
};
export type ToolActs = {
  executeChatTool: (typeof activities)["executeChatTool"];
};

export type ToolCallLike = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
};

export type LoopMessage = {
  id: string;
  role: string;
  parts: unknown[];
};

async function settleSchemaStep(input: {
  step: {
    text: string;
    structuredOutput?: unknown;
  };
  opts: {
    outputSchema?: Record<string, unknown>;
    args: InteractiveChatTurnArgs;
    deps: { short: ShortActs };
  };
  quiet: boolean;
  messages: LoopMessage[];
  withSeed: (loaded: LoopMessage[]) => LoopMessage[];
  finalizeMode: boolean;
  outputRepairs: number;
}): Promise<{
  done: boolean;
  messages: LoopMessage[];
  finalizeMode: boolean;
  outputRepairs: number;
  structuredOutput?: unknown;
}> {
  if (!input.opts.outputSchema) {
    return {
      done: true,
      messages: input.messages,
      finalizeMode: input.finalizeMode,
      outputRepairs: input.outputRepairs
    };
  }
  const candidate =
    input.step.structuredOutput !== undefined
      ? input.step.structuredOutput
      : tryParseJsonObject(input.step.text);
  const accepted = acceptStructuredOutput(input.opts.outputSchema, candidate);
  if (accepted.ok) {
    return {
      done: true,
      messages: input.messages,
      finalizeMode: input.finalizeMode,
      outputRepairs: input.outputRepairs,
      structuredOutput: accepted.value
    };
  }
  return repairInvalidOutput({
    input,
    error: accepted.error,
    finalizeMode: input.finalizeMode,
    outputRepairs: input.outputRepairs
  });
}

async function repairInvalidOutput(opts: {
  input: {
    step: { text: string };
    opts: {
      outputSchema?: Record<string, unknown>;
      args: InteractiveChatTurnArgs;
      deps: { short: ShortActs };
    };
    quiet: boolean;
    messages: LoopMessage[];
    withSeed: (loaded: LoopMessage[]) => LoopMessage[];
  };
  error: string;
  finalizeMode: boolean;
  outputRepairs: number;
}): Promise<{
  done: boolean;
  messages: LoopMessage[];
  finalizeMode: boolean;
  outputRepairs: number;
}> {
  const { input } = opts;
  let finalizeMode = opts.finalizeMode;
  let outputRepairs = opts.outputRepairs;
  if (finalizeMode && outputRepairs >= MAX_OUTPUT_REPAIRS) {
    return {
      done: true,
      messages: input.messages,
      finalizeMode,
      outputRepairs
    };
  }
  if (finalizeMode) outputRepairs += 1;
  else finalizeMode = true;
  const repairText = schemaRepairText(opts.error, input.opts.outputSchema!);
  if (input.quiet) {
    return {
      done: false,
      finalizeMode,
      outputRepairs,
      messages: [
        ...input.messages,
        {
          id: `repair-${outputRepairs}`,
          role: "assistant",
          parts: [{ type: "text", text: input.step.text || "(invalid output)" }]
        },
        {
          id: `repair-user-${outputRepairs}`,
          role: "user",
          parts: [{ type: "text", text: repairText }]
        }
      ]
    };
  }
  await input.opts.deps.short.appendChatMessage({
    sessionId: input.opts.args.sessionId,
    role: "assistant",
    parts: [{ type: "text", text: input.step.text || "(invalid output)" }],
    turnId: input.opts.args.turnId
  });
  return {
    done: false,
    finalizeMode,
    outputRepairs,
    messages: input.withSeed(
      await appendLoopUserMessage({
        quiet: false,
        short: input.opts.deps.short,
        args: input.opts.args,
        messages: input.messages,
        id: `repair-user-${outputRepairs}`,
        text: repairText
      })
    )
  };
}

async function continueAfterTools(input: {
  opts: {
    deps: ReactLoopDeps;
    args: InteractiveChatTurnArgs;
    currentMode: { value: ChatAgentMode };
    toolNameSet: Set<string>;
  };
  step: {
    text: string;
    reasoningText?: string;
    finishReason: unknown;
    toolCalls: ToolCallLike[];
  };
  quiet: boolean;
  messages: LoopMessage[];
  withSeed: (loaded: LoopMessage[]) => LoopMessage[];
}): Promise<{
  count: number;
  pendingToolsAtCap: boolean;
  pauseForUserInput: boolean;
  messages: LoopMessage[];
}> {
  const applied = await applyToolStep({
    short: input.opts.deps.short,
    tools: input.opts.deps.tools,
    args: input.opts.args,
    text: String(input.step.text ?? ""),
    reasoningText:
      input.step.reasoningText === undefined
        ? undefined
        : String(input.step.reasoningText),
    finishReason: String(input.step.finishReason ?? ""),
    toolCalls: input.step.toolCalls,
    toolNameSet: input.opts.toolNameSet,
    currentMode: input.opts.currentMode,
    messages: input.messages
  });
  if (applied.pauseForUserInput) {
    return {
      count: applied.count,
      pendingToolsAtCap: false,
      pauseForUserInput: true,
      messages: input.messages
    };
  }
  const messages = input.quiet
    ? input.messages
    : input.withSeed(
        await input.opts.deps.short.loadChatMessages(input.opts.args.sessionId)
      );
  return {
    count: applied.count,
    pendingToolsAtCap: true,
    pauseForUserInput: false,
    messages
  };
}

type LoopRound = {
  stop: boolean;
  finalText?: string;
  finalReasoningText?: string;
  toolCallCountDelta: number;
  pendingToolsAtCap: boolean;
  pauseForUserInput: boolean;
  structuredOutput?: unknown;
  messages: LoopMessage[];
  finalizeMode: boolean;
  outputRepairs: number;
};

type LoopRoundInput = {
  opts: {
    deps: ReactLoopDeps;
    args: InteractiveChatTurnArgs;
    currentMode: { value: ChatAgentMode };
    toolNameSet: Set<string>;
    outputSchema?: Record<string, unknown>;
  };
  quiet: boolean;
  messages: LoopMessage[];
  withSeed: (loaded: LoopMessage[]) => LoopMessage[];
  finalizeMode: boolean;
  outputRepairs: number;
};

async function requestLoopStep(input: LoopRoundInput) {
  const { opts } = input;
  return opts.deps.llm.runLlmStep({
    sessionId: opts.args.sessionId,
    turnId: chunkTurnId(opts.args),
    mode: opts.currentMode.value,
    provider: opts.args.provider,
    model: opts.args.model,
    reasoningEffort: opts.args.reasoningEffort,
    messages: input.messages,
    quiet: input.quiet,
    ...(opts.args.streamTurnId ? { streamTurnId: opts.args.streamTurnId } : {}),
    ...(input.finalizeMode && opts.outputSchema
      ? { outputSchema: opts.outputSchema }
      : {})
  });
}

async function finishSchemaRound(opts: {
  input: LoopRoundInput;
  step: Awaited<ReturnType<typeof requestLoopStep>>;
}): Promise<LoopRound> {
  const stopped = await settleSchemaStep({
    step: opts.step,
    opts: opts.input.opts,
    quiet: opts.input.quiet,
    messages: opts.input.messages,
    withSeed: opts.input.withSeed,
    finalizeMode: opts.input.finalizeMode,
    outputRepairs: opts.input.outputRepairs
  });
  return {
    stop: stopped.done,
    finalText: opts.step.text || undefined,
    finalReasoningText: opts.step.reasoningText || undefined,
    toolCallCountDelta: 0,
    pendingToolsAtCap: false,
    pauseForUserInput: false,
    structuredOutput: stopped.structuredOutput,
    messages: stopped.messages,
    finalizeMode: stopped.finalizeMode,
    outputRepairs: stopped.outputRepairs
  };
}

async function finishToolRound(opts: {
  input: LoopRoundInput;
  step: Awaited<ReturnType<typeof requestLoopStep>>;
}): Promise<LoopRound> {
  const continued = await continueAfterTools({
    opts: opts.input.opts,
    step: opts.step,
    quiet: opts.input.quiet,
    messages: opts.input.messages,
    withSeed: opts.input.withSeed
  });
  return {
    stop: false,
    finalText: opts.step.text || undefined,
    finalReasoningText: "",
    toolCallCountDelta: continued.count,
    pendingToolsAtCap: continued.pendingToolsAtCap,
    pauseForUserInput: continued.pauseForUserInput,
    messages: continued.messages,
    finalizeMode: opts.input.finalizeMode,
    outputRepairs: opts.input.outputRepairs
  };
}

async function takeLoopRound(input: LoopRoundInput): Promise<LoopRound> {
  const step = await requestLoopStep(input);
  if (!step.toolCalls.length) return finishSchemaRound({ input, step });
  return finishToolRound({ input, step });
}

export async function runToolRoundLoop(opts: {
  deps: ReactLoopDeps;
  args: InteractiveChatTurnArgs;
  currentMode: { value: ChatAgentMode };
  toolNameSet: Set<string>;
  maxRounds?: number;

  outputSchema?: Record<string, unknown>;

  seedMessages?: LoopMessage[];
}): Promise<ReactLoopResult> {
  const maxRounds = opts.maxRounds ?? MAX_TOOL_ROUNDS;
  const quiet = opts.args.quiet === true;
  const seed = opts.seedMessages ?? [];
  const withSeed = (loaded: LoopMessage[]) =>
    seed.length > 0 ? [...seed, ...loaded] : loaded;
  let rounds = 0;
  let finalText = "";
  let finalReasoningText = "";
  let toolCallCount = 0;
  let pendingToolsAtCap = false;
  let pauseForUserInput = false;
  let structuredOutput: unknown;
  let outputRepairs = 0;
  let finalizeMode = !opts.outputSchema;
  let messages: LoopMessage[] = quiet
    ? [...seed]
    : withSeed(await opts.deps.short.loadChatMessages(opts.args.sessionId));
  while (rounds < maxRounds) {
    rounds += 1;
    const advanced = await takeLoopRound({
      opts,
      quiet,
      messages,
      withSeed,
      finalizeMode,
      outputRepairs
    });
    if (advanced.finalText) finalText = advanced.finalText;
    if (advanced.finalReasoningText) {
      finalReasoningText = advanced.finalReasoningText;
    }
    messages = advanced.messages;
    finalizeMode = advanced.finalizeMode;
    outputRepairs = advanced.outputRepairs;
    toolCallCount += advanced.toolCallCountDelta;
    pendingToolsAtCap = advanced.pendingToolsAtCap;
    if (advanced.structuredOutput !== undefined) {
      structuredOutput = advanced.structuredOutput;
    }
    if (advanced.pauseForUserInput) {
      pauseForUserInput = true;
      break;
    }
    if (advanced.stop) break;
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
    pauseForUserInput,
    ...(structuredOutput !== undefined ? { structuredOutput } : {})
  };
}

export {
  appendLoopUserMessage,
  applyToolStep,
  assistantPartsForStep
} from "./reactLoopTools.js";
