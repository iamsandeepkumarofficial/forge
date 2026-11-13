import { startChild, ParentClosePolicy } from "@temporalio/workflow";
import type { ExecutionResult, TaskExecutionContext } from "@forge/core";
import type { InteractiveChatTurnArgs } from "../chatTurnHelpers.js";
import { assistantTextForFinalize } from "../chatTurnHelpers.js";
import type { PlanRunContext } from "../agentPlanTypes.js";
import type { TaskState } from "../agentWorkflowModel.js";
import { buildAgentChildArgs } from "../agentChildArgs.js";
import type {
  ExecuteAgentTaskArgs,
  ExecuteAgentTaskResult
} from "../executeAgentTaskWorkflow.js";
import { tryParseJsonObject } from "../jsonText.js";
import { runToolRoundLoop } from "../reactLoop.js";
import { buildTaskBrief } from "../taskBrief.js";
import { effectiveIsolation } from "../taskIsolation.js";
import type { ExecutorCall, TaskExecutor } from "./types.js";

export async function runInlineAgentTask(opts: {
  ctx: PlanRunContext;
  task: TaskState;
  context: TaskExecutionContext;
}): Promise<ExecutionResult> {
  const react = opts.ctx.react;
  if (!react) {
    return {
      kind: "failed",
      error: "inline agent executor missing react activity proxies"
    };
  }
  const mode = opts.ctx.args.mode === "plan" ? "agent" : opts.ctx.args.mode;
  const turnArgs: InteractiveChatTurnArgs = {
    sessionId: opts.context.sessionId,
    turnId: opts.context.turnId,
    userText: opts.task.description,
    mode,
    provider: opts.ctx.args.provider,
    model: opts.ctx.args.model,
    reasoningEffort: opts.ctx.args.reasoningEffort,
    quiet: false
  };
  const brief = buildTaskBrief({
    voice: "inline",
    goal: opts.ctx.goal,
    sections: opts.ctx.sections,
    taskId: opts.task.id,
    description: opts.task.description,
    rationale: opts.task.rationale,
    input: opts.context.input,
    outputSchema: opts.task.outputSchema
  });
  const toolNameSet = new Set<string>();
  const loop = await runToolRoundLoop({
    deps: {
      short: react.short,
      llm: react.llm,
      tools: react.tools
    },
    args: turnArgs,
    currentMode: { value: mode },
    toolNameSet,
    outputSchema: opts.task.outputSchema as Record<string, unknown> | undefined,
    seedMessages: [
      {
        id: `inline-${opts.task.id}-contract`,
        role: "user",
        parts: [{ type: "text", text: brief }]
      }
    ]
  });
  return inlineLoopResult({
    task: opts.task,
    loop
  });
}

function inlineLoopResult(opts: {
  task: TaskState;
  loop: {
    finalText: string;
    finalReasoningText: string;
    toolCallCount: number;
    rounds: number;
    pauseForUserInput?: boolean;
    structuredOutput?: unknown;
  };
}): ExecutionResult {
  const { task, loop } = opts;
  const finalText = assistantTextForFinalize({
    text: loop.finalText,
    reasoningText: loop.finalReasoningText,
    toolCallCount: loop.toolCallCount
  });
  if (loop.pauseForUserInput) {
    return {
      kind: "waiting",
      waitReason: {
        kind: "ask_user",
        payload: {
          taskId: task.id,
          rounds: loop.rounds,
          toolCallCount: loop.toolCallCount,
          finalText
        }
      }
    };
  }
  if (task.outputSchema && loop.structuredOutput === undefined) {
    const parsed = tryParseJsonObject(finalText);
    return {
      kind: "failed",
      error:
        parsed === undefined
          ? "agent finished without schema-valid structured output"
          : "agent finished with invalid structured output"
    };
  }
  const structured =
    loop.structuredOutput !== undefined
      ? loop.structuredOutput
      : { summary: finalText || "completed" };
  return {
    kind: "completed",
    output: { kind: "value", value: structured },
    metrics: {
      rounds: loop.rounds,
      toolCallCount: loop.toolCallCount
    }
  };
}

export async function runChildAgentTask(opts: {
  ctx: PlanRunContext;
  task: TaskState;
  context: TaskExecutionContext;
}): Promise<ExecutionResult> {
  opts.task.input = opts.context.input;
  const childArgs: ExecuteAgentTaskArgs = await buildAgentChildArgs({
    ctx: opts.ctx,
    task: opts.task
  });
  const handle = await startChild("executeAgentTaskWorkflow", {
    args: [childArgs],
    workflowId: `agent-task-${opts.context.sessionId}-${opts.context.turnId}-${opts.task.id}-${childArgs.attempt}`,
    parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_REQUEST_CANCEL
  });
  const child = (await handle.result()) as ExecuteAgentTaskResult;
  if (child.status === "completed") {
    const structured =
      child.structuredOutput !== undefined
        ? child.structuredOutput
        : { summary: child.finalText || "completed" };
    return {
      kind: "completed",
      output: { kind: "value", value: structured },
      metrics: {
        rounds: child.rounds,
        toolCallCount: child.toolCallCount
      }
    };
  }
  if (child.status === "waiting") {
    return {
      kind: "waiting",
      waitReason: {
        kind: (child.waitReason?.kind as "ask_user") ?? "ask_user",
        payload: {
          ...(typeof child.waitReason?.payload === "object" &&
          child.waitReason?.payload
            ? (child.waitReason.payload as object)
            : {}),
          rounds: child.rounds,
          toolCallCount: child.toolCallCount,
          finalText: child.finalText
        }
      }
    };
  }
  if (child.status === "cancelled") {
    return { kind: "failed", error: child.error ?? "agent task cancelled" };
  }
  return { kind: "failed", error: child.error ?? "agent task failed" };
}

export type AgentExecutorDeps = {
  ctx: PlanRunContext;
};

export class AgentExecutor implements TaskExecutor {
  constructor(private readonly deps: AgentExecutorDeps) {}

  async execute(call: ExecutorCall): Promise<ExecutionResult> {
    const isolation = effectiveIsolation({
      task: call.task,
      forceChildIsolation: this.deps.ctx.forceChildIsolation
    });
    if (isolation === "child") {
      return runChildAgentTask({
        ctx: this.deps.ctx,
        task: call.task,
        context: call.context
      });
    }
    return runInlineAgentTask({
      ctx: this.deps.ctx,
      task: call.task,
      context: call.context
    });
  }
}
