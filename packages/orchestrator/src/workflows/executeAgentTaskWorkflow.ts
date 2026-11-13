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
import { tryParseJsonObject } from "./jsonText.js";
import { assistantPartsForStep, runToolRoundLoop } from "./reactLoop.js";
import { buildTaskBrief } from "./taskBrief.js";

export type ExecuteAgentTaskArgs = {
  sessionId: string;
  turnId: string;
  planId: string;
  planVersion: number;
  taskId: string;
  description: string;

  input?: unknown;

  outputSchema?: Record<string, unknown>;
  provider: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
  mode: ChatAgentMode;
  worktreePath?: string | null;
  attempt: number;

  quiet?: boolean;

  streamTurnId?: string;
};

export type ExecuteAgentTaskResult = {
  taskId: string;
  status: "completed" | "failed" | "cancelled" | "waiting";
  finalText: string;

  structuredOutput?: unknown;
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
  if (args.quiet) {
    return;
  }
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

async function finishStreamTurn(
  args: ExecuteAgentTaskArgs,
  status: "completed" | "cancelled" | "failed"
): Promise<void> {
  if (!args.streamTurnId) return;
  await CancellationScope.nonCancellable(async () => {
    await short.finishChatTurn({
      turnId: args.streamTurnId!,
      status
    });
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
  if (!opts.args.quiet) {
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
  }

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
  structuredOutput?: unknown;
}): Promise<ExecuteAgentTaskResult> {
  const structured =
    opts.structuredOutput !== undefined
      ? opts.structuredOutput
      : { summary: opts.finalText || "completed" };
  if (!opts.args.quiet) {
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
        output: { kind: "value", value: structured },
        error: null
      }
    });
    await short.publishTaskUpdated({
      turnId: opts.args.turnId,
      task: { id: opts.args.taskId, status: "completed" }
    });
  }
  await finishStreamTurn(opts.args, "completed");
  return {
    taskId: opts.args.taskId,
    status: "completed",
    finalText: opts.finalText,
    structuredOutput: structured,
    rounds: opts.rounds,
    toolCallCount: opts.toolCallCount
  };
}

async function markTaskCancelled(
  args: ExecuteAgentTaskArgs
): Promise<ExecuteAgentTaskResult> {
  if (!args.quiet) {
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
  }
  await finishStreamTurn(args, "cancelled");
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
  if (!args.quiet) {
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
  }
  await finishStreamTurn(args, "failed");
  return {
    taskId: args.taskId,
    status: "failed",
    finalText: "",
    rounds: 0,
    toolCallCount: 0,
    error: message
  };
}

function taskContractSeed(args: ExecuteAgentTaskArgs): Array<{
  id: string;
  role: string;
  parts: unknown[];
}> {
  const contractPrompt =
    args.quiet === true
      ? args.description
      : buildTaskBrief({
          voice: "task",
          taskId: args.taskId,
          description: args.description,
          input: args.input,
          outputSchema: args.outputSchema
        });
  return [
    {
      id: `task-${args.taskId}-contract`,
      role: "user",
      parts: [{ type: "text", text: contractPrompt }]
    }
  ];
}

export async function executeAgentTaskWorkflow(
  args: ExecuteAgentTaskArgs
): Promise<ExecuteAgentTaskResult> {
  const toolNameSet = new Set<string>();
  const quiet = args.quiet === true;
  const turnArgs: InteractiveChatTurnArgs = {
    sessionId: args.sessionId,
    turnId: args.turnId,
    userText: args.description,
    mode: args.mode === "plan" ? "agent" : args.mode,
    provider: args.provider,
    model: args.model,
    reasoningEffort: args.reasoningEffort,
    quiet,
    ...(args.streamTurnId ? { streamTurnId: args.streamTurnId } : {})
  };
  try {
    await markTaskRunning(args);
    const seedMessages = taskContractSeed(args);
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
      toolNameSet,
      outputSchema: args.outputSchema,
      ...(seedMessages ? { seedMessages } : {})
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
    if (args.outputSchema && loop.structuredOutput === undefined) {
      const parsed = tryParseJsonObject(finalText);
      return markTaskFailed(
        args,
        new Error(
          parsed === undefined
            ? "agent finished without schema-valid structured output"
            : "agent finished with invalid structured output"
        )
      );
    }
    return markTaskCompleted({
      args,
      finalText,
      reasoningText: loop.finalReasoningText,
      rounds: loop.rounds,
      toolCallCount: loop.toolCallCount,
      ...(loop.structuredOutput !== undefined
        ? { structuredOutput: loop.structuredOutput }
        : {})
    });
  } catch (err) {
    if (isCancellation(err)) {
      return markTaskCancelled(args);
    }
    return markTaskFailed(args, err);
  }
}
