import { sleep } from "@temporalio/workflow";
import type { ExecutionResult, TaskExecutionContext } from "@forge/core";
import type { TaskBuckets } from "./agentPlanClassify.js";
import type { PlanRunContext } from "./agentPlanTypes.js";
import type { TaskState } from "./agentWorkflowModel.js";
import { isResumableExecutor, type TaskExecutor } from "./executors/index.js";

const STALL_SLEEP = "2 seconds";

export function executionContextFor(
  ctx: PlanRunContext,
  task: TaskState
): TaskExecutionContext {
  return {
    workflowId: ctx.workflowId,
    sessionId: ctx.args.sessionId,
    turnId: ctx.args.turnId,
    planId: ctx.planId,
    taskId: task.id
  };
}

async function persistExecutionResult(opts: {
  ctx: PlanRunContext;
  task: TaskState;
  result: ExecutionResult;
}): Promise<void> {
  const { ctx, task, result } = opts;
  if (result.kind === "waiting") {
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
    return;
  }
  if (result.kind === "completed") {
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
    return;
  }
  task.status = "failed";
  task.waitReason = null;
  task.error = result.error;
  await ctx.short.persistTask({
    planId: ctx.planId,
    version: ctx.version,
    taskId: task.id,
    patch: {
      status: "failed",
      waitReason: null,
      error: result.error
    }
  });
  await ctx.short.publishTaskUpdated({
    turnId: ctx.args.turnId,
    task: { id: task.id, status: "failed", error: result.error }
  });
}

function accumulateMetrics(ctx: PlanRunContext, result: ExecutionResult): void {
  if (result.kind !== "completed" && result.kind !== "waiting") {
    return;
  }
  const bag =
    result.kind === "completed" ? result.output : result.waitReason.payload;
  if (!bag || typeof bag !== "object") {
    return;
  }
  const m = bag as {
    rounds?: unknown;
    toolCallCount?: unknown;
    finalText?: unknown;
  };
  if (typeof m.rounds === "number") {
    ctx.rounds += m.rounds;
  }
  if (typeof m.toolCallCount === "number") {
    ctx.toolCallCount += m.toolCallCount;
  }
  if (typeof m.finalText === "string" && m.finalText) {
    ctx.finalText = m.finalText;
  }
}

export async function applyExecutionResult(opts: {
  ctx: PlanRunContext;
  taskId: string;
  result: ExecutionResult;
  worktreePath: string | null;
}): Promise<void> {
  const task = opts.ctx.tasks.find((item) => item.id === opts.taskId);
  if (!task) {
    return;
  }
  accumulateMetrics(opts.ctx, opts.result);
  await persistExecutionResult({
    ctx: opts.ctx,
    task,
    result: opts.result
  });
  if (opts.result.kind === "completed" && opts.worktreePath) {
    await mergeCompletedWorktree({
      ctx: opts.ctx,
      task,
      worktreePath: opts.worktreePath
    });
  }
}

async function mergeCompletedWorktree(opts: {
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

async function markTaskRunning(opts: {
  ctx: PlanRunContext;
  task: TaskState;
}): Promise<void> {
  opts.task.status = "running";
  opts.task.attemptCount += 1;
  opts.task.waitReason = null;
  opts.task.error = undefined;
  await opts.ctx.short.persistTask({
    planId: opts.ctx.planId,
    version: opts.ctx.version,
    taskId: opts.task.id,
    patch: {
      status: "running",
      attemptCount: opts.task.attemptCount,
      waitReason: null,
      error: null,
      startedAt: new Date().toISOString()
    }
  });
  await opts.ctx.short.publishTaskUpdated({
    turnId: opts.ctx.args.turnId,
    task: { id: opts.task.id, status: "running" }
  });
}

function trackInFlight(opts: {
  ctx: PlanRunContext;
  task: TaskState;
  worktreePath: string | null;
  resultPromise: Promise<ExecutionResult>;
}): void {
  opts.ctx.inFlight.set(opts.task.id, {
    taskId: opts.task.id,
    worktreePath: opts.worktreePath,
    resultPromise: opts.resultPromise.then((result) => ({
      taskId: opts.task.id,
      result,
      worktreePath: opts.worktreePath
    }))
  });
}

export async function launchReadyTasks(opts: {
  ctx: PlanRunContext;
  toStart: string[];
}): Promise<void> {
  for (const taskId of opts.toStart) {
    const task = opts.ctx.tasks.find((item) => item.id === taskId);
    if (!task) {
      continue;
    }
    const executor: TaskExecutor | undefined = opts.ctx.registry.get(
      task.executor
    );
    if (!executor) {
      await persistExecutionResult({
        ctx: opts.ctx,
        task,
        result: {
          kind: "failed",
          error: `unknown executor: ${task.executor}`
        }
      });
      continue;
    }
    const context = executionContextFor(opts.ctx, task);
    if (task.executor === "human") {
      const result = await executor.execute({ task, context });
      await persistExecutionResult({ ctx: opts.ctx, task, result });
      continue;
    }
    await markTaskRunning({ ctx: opts.ctx, task });
    const resultPromise = executor.execute({ task, context });
    trackInFlight({
      ctx: opts.ctx,
      task,
      worktreePath: null,
      resultPromise: resultPromise.then((result) => {
        const entry = opts.ctx.inFlight.get(task.id);
        const path = task.worktreePath ?? null;
        if (entry) {
          entry.worktreePath = path;
        }
        return result;
      })
    });
  }
}

export async function resumeWaitingTask(opts: {
  ctx: PlanRunContext;
  task: TaskState;
  payload: unknown;
}): Promise<void> {
  const executor = opts.ctx.registry.get(opts.task.executor);
  if (!executor || !isResumableExecutor(executor)) {
    opts.task.status = "pending";
    opts.task.waitReason = null;
    opts.task.error = undefined;
    await opts.ctx.short.persistTask({
      planId: opts.ctx.planId,
      version: opts.ctx.version,
      taskId: opts.task.id,
      patch: { status: "pending", waitReason: null, error: null }
    });
    await opts.ctx.short.publishTaskUpdated({
      turnId: opts.ctx.args.turnId,
      task: { id: opts.task.id, status: "pending" }
    });
    return;
  }
  const context = executionContextFor(opts.ctx, opts.task);
  const result = await executor.resume({
    task: opts.task,
    payload: opts.payload,
    context
  });
  if (result.kind === "waiting") {
    await persistExecutionResult({
      ctx: opts.ctx,
      task: opts.task,
      result
    });
    return;
  }
  if (result.kind === "completed" || result.kind === "failed") {
    await persistExecutionResult({
      ctx: opts.ctx,
      task: opts.task,
      result
    });
  }
}

export async function handleEmptyInFlight(opts: {
  ctx: PlanRunContext;
  buckets: TaskBuckets;
  readyCount: number;
}): Promise<"break" | "continue" | null> {
  if (opts.ctx.inFlight.size > 0) {
    return null;
  }
  if (opts.buckets.waiting.length > 0) {
    return "continue";
  }
  if (
    opts.buckets.pending.length > 0 &&
    opts.buckets.waiting.length === 0 &&
    opts.buckets.failed.length === 0
  ) {
    if (opts.readyCount === 0) {
      opts.ctx.planStatus = "failed";
      return "break";
    }
    await sleep(STALL_SLEEP);
    return "continue";
  }
  if (opts.buckets.failed.length > 0) {
    opts.ctx.planStatus = "failed";
    return "break";
  }
  opts.ctx.planStatus = "completed";
  return "break";
}
