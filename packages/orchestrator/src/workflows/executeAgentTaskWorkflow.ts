import {
  proxyActivities,
  isCancellation,
  CancellationScope
} from "@temporalio/workflow";
import type * as activities from "../activities/index.js";
import {
  assistantTextForFinalize,
  failureMessage,
  isLocalChatProvider,
  type ChatAgentMode,
  type InteractiveChatTurnArgs
} from "./chatTurnHelpers.js";
import { assistantPartsForStep, runToolRoundLoop } from "./reactLoop.js";

export type ExecuteAgentTaskArgs = {
  sessionId: string;
  turnId: string;
  planId: string;
  planVersion: number;
  taskId: string;
  description: string;
  provider: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
  mode: ChatAgentMode;
  worktreePath?: string | null;
  attempt: number;
};

export type ExecuteAgentTaskResult = {
  taskId: string;
  status: "completed" | "failed" | "cancelled" | "waiting";
  finalText: string;
  rounds: number;
  toolCallCount: number;
  error?: string;
  waitReason?: { kind: string; payload?: unknown } | null;
};

const short = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 5, initialInterval: "2s", backoffCoefficient: 2 }
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

async function markTaskRunning(args: ExecuteAgentTaskArgs): Promise<void> {
  await short.persistTask({
    planId: args.planId,
    version: args.planVersion,
    taskId: args.taskId,
    patch: {
      status: "running",
      attemptCount: args.attempt,
      startedAt: new Date().toISOString(),
      worktreePath: args.worktreePath ?? null,
      error: null
    }
  });
  await short.publishTaskUpdated({
    turnId: args.turnId,
    task: {
      id: args.taskId,
      status: "running",
      attemptCount: args.attempt,
      description: args.description
    }
  });
  await short.appendPlanChunk({
    turnId: args.turnId,
    eventType: "task_started",
    payload: {
      taskId: args.taskId,
      description: args.description,
      attempt: args.attempt
    }
  });
}

async function markTaskWaiting(opts: {
  args: ExecuteAgentTaskArgs;
  finalText: string;
  rounds: number;
  toolCallCount: number;
}): Promise<ExecuteAgentTaskResult> {
  const waitReason = {
    kind: "ask_user" as const,
    payload: { taskId: opts.args.taskId }
  };
  await short.persistTask({
    planId: opts.args.planId,
    version: opts.args.planVersion,
    taskId: opts.args.taskId,
    patch: {
      status: "waiting",
      waitReason,
      output: { text: opts.finalText }
    }
  });
  await short.publishTaskUpdated({
    turnId: opts.args.turnId,
    task: { id: opts.args.taskId, status: "waiting", waitReason }
  });
  return {
    taskId: opts.args.taskId,
    status: "waiting",
    finalText: opts.finalText,
    rounds: opts.rounds,
    toolCallCount: opts.toolCallCount,
    waitReason
  };
}

async function markTaskCompleted(opts: {
  args: ExecuteAgentTaskArgs;
  finalText: string;
  reasoningText: string;
  rounds: number;
  toolCallCount: number;
}): Promise<ExecuteAgentTaskResult> {
  await short.appendChatMessage({
    sessionId: opts.args.sessionId,
    role: "assistant",
    parts: assistantPartsForStep({
      reasoningText: opts.reasoningText,
      text: opts.finalText
    }),
    turnId: opts.args.turnId
  });
  await short.persistTask({
    planId: opts.args.planId,
    version: opts.args.planVersion,
    taskId: opts.args.taskId,
    patch: {
      status: "completed",
      finishedAt: new Date().toISOString(),
      output: { text: opts.finalText },
      error: null
    }
  });
  await short.publishTaskUpdated({
    turnId: opts.args.turnId,
    task: { id: opts.args.taskId, status: "completed" }
  });
  return {
    taskId: opts.args.taskId,
    status: "completed",
    finalText: opts.finalText,
    rounds: opts.rounds,
    toolCallCount: opts.toolCallCount
  };
}

async function markTaskCancelled(
  args: ExecuteAgentTaskArgs
): Promise<ExecuteAgentTaskResult> {
  await CancellationScope.nonCancellable(async () => {
    await short.persistTask({
      planId: args.planId,
      version: args.planVersion,
      taskId: args.taskId,
      patch: {
        status: "cancelled",
        finishedAt: new Date().toISOString()
      }
    });
    await short.publishTaskUpdated({
      turnId: args.turnId,
      task: { id: args.taskId, status: "cancelled" }
    });
  });
  return {
    taskId: args.taskId,
    status: "cancelled",
    finalText: "",
    rounds: 0,
    toolCallCount: 0
  };
}

async function markTaskFailed(
  args: ExecuteAgentTaskArgs,
  err: unknown
): Promise<ExecuteAgentTaskResult> {
  const message = failureMessage(err);
  await short.persistTask({
    planId: args.planId,
    version: args.planVersion,
    taskId: args.taskId,
    patch: {
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: message
    }
  });
  await short.publishTaskUpdated({
    turnId: args.turnId,
    task: { id: args.taskId, status: "failed", error: message }
  });
  return {
    taskId: args.taskId,
    status: "failed",
    finalText: "",
    rounds: 0,
    toolCallCount: 0,
    error: message
  };
}

export async function executeAgentTaskWorkflow(
  args: ExecuteAgentTaskArgs
): Promise<ExecuteAgentTaskResult> {
  const toolNameSet = new Set<string>();
  const turnArgs: InteractiveChatTurnArgs = {
    sessionId: args.sessionId,
    turnId: args.turnId,
    userText: args.description,
    mode: args.mode === "plan" ? "agent" : args.mode,
    provider: args.provider,
    model: args.model,
    reasoningEffort: args.reasoningEffort
  };
  try {
    await markTaskRunning(args);
    const loop = await runToolRoundLoop({
      deps: {
        short,
        llm: llmActivities(args.provider),
        tools
      },
      args: turnArgs,
      currentMode: {
        value: args.mode === "plan" ? "agent" : args.mode
      },
      toolNameSet
    });
    const finalText = assistantTextForFinalize({
      text: loop.finalText,
      reasoningText: loop.finalReasoningText,
      toolCallCount: loop.toolCallCount
    });
    if (loop.pauseForUserInput) {
      return markTaskWaiting({
        args,
        finalText,
        rounds: loop.rounds,
        toolCallCount: loop.toolCallCount
      });
    }
    return markTaskCompleted({
      args,
      finalText,
      reasoningText: loop.finalReasoningText,
      rounds: loop.rounds,
      toolCallCount: loop.toolCallCount
    });
  } catch (err) {
    if (isCancellation(err)) {
      return markTaskCancelled(args);
    }
    return markTaskFailed(args, err);
  }
}
