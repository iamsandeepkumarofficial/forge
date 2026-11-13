import { sleep } from "@temporalio/workflow";
import type { ExecutionResult, TaskExecutionContext } from "@forge/core";
import type { TaskBuckets } from "./agentPlanClassify.js";
import type { PlanRunContext } from "./agentPlanTypes.js";
import type { TaskState } from "./agentWorkflowModel.js";
import { isResumableExecutor, type TaskExecutor } from "./executors/index.js";
import { effectiveIsolation } from "./taskIsolation.js";
import {
  accumulateMetrics,
  finalizeCompletedOutput,
  isToolInvocationInput,
  markTaskRunning,
  mergeCompletedWorktree,
  persistExecutionResult,
  prepareAndValidateInput,
  transcriptNoteFromOutput
} from "./taskLaunchPrep.js";

export { transcriptNoteFromOutput };

const STALL_SLEEP = "2 seconds";

export function executionContextFor(opts: {
  ctx: PlanRunContext;
  task: TaskState;
  input?: unknown;
}): TaskExecutionContext {
  return {
    workflowId: opts.ctx.workflowId,
    sessionId: opts.ctx.args.sessionId,
    turnId: opts.ctx.args.turnId,
    planId: opts.ctx.planId,
    taskId: opts.task.id,
    input: opts.input ?? opts.task.input ?? {}
  };
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
  let result = opts.result;
  let materialized: unknown;
  if (opts.result.kind === "completed") {
    const finalized = await finalizeCompletedOutput({
      ctx: opts.ctx,
      task,
      result: opts.result
    });
    result = finalized.result;
    materialized = finalized.materialized;
  }
  accumulateMetrics({ ctx: opts.ctx, result, materialized });
  await persistExecutionResult({
    ctx: opts.ctx,
    task,
    result,
    materialized
  });
  if (result.kind === "completed" && opts.worktreePath) {
    await mergeCompletedWorktree({
      ctx: opts.ctx,
      task,
      worktreePath: opts.worktreePath
    });
  }
}

export function serializeAgentStarts(opts: {
  ctx: PlanRunContext;
  toStart: string[];
}): string[] {
  const inlineAlreadyRunning = [...opts.ctx.inFlight.values()].some((entry) => {
    const task = opts.ctx.tasks.find((t) => t.id === entry.taskId);
    if (!task || task.executor !== "agent") return false;
    return (
      effectiveIsolation({
        task,
        forceChildIsolation: opts.ctx.forceChildIsolation
      }) === "inline"
    );
  });
  const out: string[] = [];
  let inlineQueued = inlineAlreadyRunning;
  for (const taskId of opts.toStart) {
    const task = opts.ctx.tasks.find((t) => t.id === taskId);
    if (!task) continue;
    if (task.executor !== "agent") {
      out.push(taskId);
      continue;
    }
    const isolation = effectiveIsolation({
      task,
      forceChildIsolation: opts.ctx.forceChildIsolation
    });
    if (isolation === "inline") {
      if (inlineQueued) continue;
      inlineQueued = true;
      out.push(taskId);
      continue;
    }
    out.push(taskId);
  }
  return out;
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
    const prepared = await prepareAndValidateInput({ ctx: opts.ctx, task });
    if (!prepared.ok) {
      await persistExecutionResult({
        ctx: opts.ctx,
        task,
        result: { kind: "failed", error: prepared.error }
      });
      continue;
    }

    if (!isToolInvocationInput(task.input) || task.executor !== "tool") {
      task.input = prepared.input;
    }
    const context = executionContextFor({
      ctx: opts.ctx,
      task,
      input: prepared.input
    });
    if (task.executor === "human") {
      const result = await executor.execute({ task, context });
      await applyExecutionResult({
        ctx: opts.ctx,
        taskId: task.id,
        result,
        worktreePath: null
      });
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
  const context = executionContextFor({
    ctx: opts.ctx,
    task: opts.task,
    input: opts.task.input ?? {}
  });
  const result = await executor.resume({
    task: opts.task,
    payload: opts.payload,
    context
  });
  await applyExecutionResult({
    ctx: opts.ctx,
    taskId: opts.task.id,
    result,
    worktreePath: null
  });
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
