import {
  isValueOutput,
  validateTaskInput,
  validateTaskOutput,
  type ExecutionResult,
  type TaskOutput
} from "@forge/core";
import type { PlanRunContext } from "./agentPlanTypes.js";
import type { TaskState } from "./agentWorkflowModel.js";
import { ensureTaskStreamTurn } from "./agentChildArgs.js";
import { effectiveIsolation } from "./taskIsolation.js";
import { transcriptNoteFromOutput } from "./taskResultNote.js";

export {
  accumulateMetrics,
  transcriptNoteFromOutput
} from "./taskResultNote.js";

function dependencyOutputsFor(ctx: PlanRunContext, task: TaskState) {
  return task.dependencies.map((id) => {
    const dep = ctx.tasks.find((item) => item.id === id);
    const output =
      dep?.output !== undefined && dep.output !== null
        ? (dep.output as TaskOutput)
        : null;
    return { id, output };
  });
}

function contractStaticInput(
  task: Pick<TaskState, "executor" | "input">
): unknown {
  if (task.executor !== "tool" || !isToolInvocationInput(task.input)) {
    return task.input;
  }
  const rest = { ...(task.input as Record<string, unknown>) };
  delete rest.toolName;
  delete rest.args;
  return rest;
}

export function isToolInvocationInput(input: unknown): boolean {
  return (
    !!input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    typeof (input as { toolName?: unknown }).toolName === "string"
  );
}

export async function prepareAndValidateInput(opts: {
  ctx: PlanRunContext;
  task: TaskState;
}): Promise<{ ok: true; input: unknown } | { ok: false; error: string }> {
  const prepared = await opts.ctx.short.prepareTaskInput({
    sessionId: opts.ctx.args.sessionId,
    planId: opts.ctx.planId,
    taskId: opts.task.id,
    inputMappings: opts.task.inputMappings,
    dependencies: dependencyOutputsFor(opts.ctx, opts.task),
    staticInput: contractStaticInput(opts.task)
  });
  if (!prepared.ok) {
    return prepared;
  }
  const validated = validateTaskInput(opts.task.inputSchema, prepared.input);
  if (!validated.ok) {
    return {
      ok: false,
      error: validated.errors.map((e) => e.message).join("; ")
    };
  }
  return { ok: true, input: prepared.input };
}

export async function finalizeCompletedOutput(opts: {
  ctx: PlanRunContext;
  task: TaskState;
  result: Extract<ExecutionResult, { kind: "completed" }>;
}): Promise<{ result: ExecutionResult; materialized?: unknown }> {
  const raw = opts.result.output;
  const value = isValueOutput(raw) ? raw.value : raw;
  const validated = validateTaskOutput(opts.task.outputSchema, value);
  if (!validated.ok) {
    return {
      result: {
        kind: "failed",
        error: `outputSchema validation failed: ${validated.errors
          .map((e) => e.message)
          .join("; ")}`
      }
    };
  }
  const spilled = await opts.ctx.short.spillTaskOutput({
    sessionId: opts.ctx.args.sessionId,
    planId: opts.ctx.planId,
    taskId: opts.task.id,
    value: validated.value
  });
  return {
    materialized: validated.value,
    result: {
      kind: "completed",
      output: spilled,
      ...(opts.result.metrics ? { metrics: opts.result.metrics } : {})
    }
  };
}

async function persistWaitingResult(opts: {
  ctx: PlanRunContext;
  task: TaskState;
  result: Extract<ExecutionResult, { kind: "waiting" }>;
}): Promise<void> {
  const { ctx, task, result } = opts;
  task.status = "waiting";
  task.waitReason = result.waitReason;
  task.error = undefined;
  await ctx.short.persistTask({
    planId: ctx.planId,
    version: ctx.version,
    taskId: task.id,
    patch: {
      status: "waiting",
      waitReason: task.waitReason,
      error: null
    }
  });
  await ctx.short.publishTaskUpdated({
    turnId: ctx.args.turnId,
    task: {
      id: task.id,
      status: "waiting",
      waitReason: task.waitReason
    }
  });
}

async function persistCompletedResult(opts: {
  ctx: PlanRunContext;
  task: TaskState;
  result: Extract<ExecutionResult, { kind: "completed" }>;
  materialized?: unknown;
}): Promise<void> {
  const { ctx, task, result } = opts;
  task.status = "completed";
  task.waitReason = null;
  task.error = undefined;
  task.output = result.output;
  await ctx.short.persistTask({
    planId: ctx.planId,
    version: ctx.version,
    taskId: task.id,
    patch: {
      status: "completed",
      waitReason: null,
      error: null,
      output: result.output ?? null,
      finishedAt: new Date().toISOString()
    }
  });
  await ctx.short.publishTaskUpdated({
    turnId: ctx.args.turnId,
    task: { id: task.id, status: "completed" }
  });
  const note = transcriptNoteFromOutput({
    taskId: task.id,
    description: task.description,
    output: result.output,
    materialized: opts.materialized
  });
  if (!note) return;
  await ctx.short.appendChatMessage({
    sessionId: ctx.args.sessionId,
    role: "assistant",
    parts: [{ type: "text", text: note }],
    turnId: ctx.args.turnId
  });
  await ctx.short.appendPlanChunk({
    turnId: ctx.args.turnId,
    eventType: "task_result_message",
    payload: { taskId: task.id, text: note }
  });
}

async function persistFailedResult(opts: {
  ctx: PlanRunContext;
  task: TaskState;
  result: Extract<ExecutionResult, { kind: "failed" }>;
}): Promise<void> {
  const { ctx, task, result } = opts;
  task.status = "failed";
  task.waitReason = null;
  task.error = result.error;
  task.streamTurnId = null;
  await ctx.short.persistTask({
    planId: ctx.planId,
    version: ctx.version,
    taskId: task.id,
    patch: {
      status: "failed",
      waitReason: null,
      error: result.error,
      streamTurnId: null
    }
  });
  await ctx.short.publishTaskUpdated({
    turnId: ctx.args.turnId,
    task: { id: task.id, status: "failed", error: result.error }
  });
}

export async function persistExecutionResult(opts: {
  ctx: PlanRunContext;
  task: TaskState;
  result: ExecutionResult;
  materialized?: unknown;
}): Promise<void> {
  if (opts.result.kind === "waiting") {
    await persistWaitingResult({
      ctx: opts.ctx,
      task: opts.task,
      result: opts.result
    });
    return;
  }
  if (opts.result.kind === "completed") {
    await persistCompletedResult({
      ctx: opts.ctx,
      task: opts.task,
      result: opts.result,
      materialized: opts.materialized
    });
    return;
  }
  await persistFailedResult({
    ctx: opts.ctx,
    task: opts.task,
    result: opts.result
  });
}

export async function mergeCompletedWorktree(opts: {
  ctx: PlanRunContext;
  task: TaskState;
  worktreePath: string;
}): Promise<void> {
  const merge = await opts.ctx.short.mergeTaskWorktree({
    sessionId: opts.ctx.args.sessionId,
    taskId: opts.task.id,
    taskWorktreePath: opts.worktreePath
  });
  if (merge.ok) {
    return;
  }
  opts.task.status = "waiting";
  opts.task.waitReason = {
    kind: "merge_conflict",
    payload: {
      paths: merge.paths ?? [],
      message: merge.message
    }
  };
  await opts.ctx.short.persistTask({
    planId: opts.ctx.planId,
    version: opts.ctx.version,
    taskId: opts.task.id,
    patch: {
      status: "waiting",
      waitReason: opts.task.waitReason
    }
  });
  await opts.ctx.short.publishMergeConflict({
    turnId: opts.ctx.args.turnId,
    status: "waiting_human",
    paths: merge.paths ?? [],
    originatingTaskIds: [opts.task.id]
  });
}

export async function markTaskRunning(opts: {
  ctx: PlanRunContext;
  task: TaskState;
}): Promise<void> {
  opts.task.status = "running";
  opts.task.attemptCount += 1;
  opts.task.waitReason = null;
  opts.task.error = undefined;
  const isolation = effectiveIsolation({
    task: opts.task,
    forceChildIsolation: opts.ctx.forceChildIsolation
  });
  if (isolation === "child") {
    await ensureTaskStreamTurn({ ctx: opts.ctx, task: opts.task });
  } else {
    opts.task.streamTurnId = null;
  }
  const streamTurnId = opts.task.streamTurnId ?? null;
  await opts.ctx.short.persistTask({
    planId: opts.ctx.planId,
    version: opts.ctx.version,
    taskId: opts.task.id,
    patch: {
      status: "running",
      attemptCount: opts.task.attemptCount,
      waitReason: null,
      error: null,
      startedAt: new Date().toISOString(),
      streamTurnId
    }
  });
  await opts.ctx.short.publishTaskUpdated({
    turnId: opts.ctx.args.turnId,
    task: {
      id: opts.task.id,
      status: "running",
      attemptCount: opts.task.attemptCount,
      description: opts.task.description,
      ...(streamTurnId ? { streamTurnId } : {}),
      ...(isolation === "child" ? { isolation: "child" } : {})
    }
  });
  await opts.ctx.short.appendPlanChunk({
    turnId: opts.ctx.args.turnId,
    eventType: "task_started",
    payload: {
      taskId: opts.task.id,
      description: opts.task.description,
      attempt: opts.task.attemptCount,
      ...(streamTurnId ? { streamTurnId } : {})
    }
  });
}
