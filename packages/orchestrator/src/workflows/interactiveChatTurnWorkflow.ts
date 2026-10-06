import { proxyActivities, isCancellation } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";
import {
  assistantTextForFinalize,
  buildResult,
  failureMessage,
  isLocalChatProvider,
  type InteractiveChatTurnArgs,
  type InteractiveChatTurnResult
} from "./chatTurnHelpers.js";
import { assistantPartsForStep, runToolRoundLoop } from "./reactLoop.js";

export type {
  ChatAgentMode,
  InteractiveChatTurnArgs,
  InteractiveChatTurnResult
} from "./chatTurnHelpers.js";
export {
  assistantTextForFinalize,
  buildResult,
  failureMessage,
  isLocalChatProvider,
  previewText
} from "./chatTurnHelpers.js";
export { MAX_TOOL_ROUNDS } from "./chatTurnLimits.js";

const short = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 5, initialInterval: "2s", backoffCoefficient: 2 }
});
const sandbox = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  heartbeatTimeout: "30 seconds",
  retry: { maximumAttempts: 3, initialInterval: "5s", backoffCoefficient: 2 }
});
const llmCloud = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  heartbeatTimeout: "2 minutes",
  retry: { maximumAttempts: 1 }
});
const llmLocal = proxyActivities<typeof activities>({
  startToCloseTimeout: "45 minutes",
  heartbeatTimeout: "5 minutes",
  retry: { maximumAttempts: 1 }
});
const tools = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  heartbeatTimeout: "5 minutes",
  retry: { maximumAttempts: 2, initialInterval: "5s" }
});

function llmActivities(provider: string) {
  return isLocalChatProvider(provider) ? llmLocal : llmCloud;
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

export async function interactiveChatTurnWorkflow(
  args: InteractiveChatTurnArgs
): Promise<InteractiveChatTurnResult> {
  const toolNameSet = new Set<string>();
  let rounds = 0;
  let finalText = "";
  let toolCallCount = 0;
  try {
    await sandbox.ensureChatSandbox(args.sessionId);
    await short.appendChatMessage({
      sessionId: args.sessionId,
      role: "user",
      parts: [{ type: "text", text: args.userText }],
      turnId: args.turnId
    });
    const loop = await runToolRoundLoop({
      deps: {
        short,
        llm: llmActivities(args.provider),
        tools
      },
      args,
      currentMode: { value: args.mode },
      toolNameSet
    });
    rounds = loop.rounds;
    finalText = assistantTextForFinalize({
      text: loop.finalText,
      reasoningText: loop.finalReasoningText,
      toolCallCount: loop.toolCallCount
    });
    toolCallCount = loop.toolCallCount;
    await short.finalizeChatTurn({
      sessionId: args.sessionId,
      turnId: args.turnId,
      assistantParts: assistantPartsForStep({
        reasoningText: loop.finalReasoningText,
        text: finalText
      }),
      status: "completed"
    });
    return buildResult(args, {
      status: "completed",
      rounds,
      toolNames: [...toolNameSet].sort(),
      toolCallCount,
      finalText
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
