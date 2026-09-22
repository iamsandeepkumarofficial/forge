import { condition } from "@temporalio/workflow";
import { MAX_REPLAN_COUNT, accrueWorkingMs } from "@forge/core";
import type * as activities from "../activities/index.js";
import type { ExecuteAgentTaskResult } from "./executeAgentTaskWorkflow.js";
import { draftToTasks, type TaskState } from "./agentWorkflowModel.js";
import {
  collectTaskBuckets,
  keepCompletedOnReplan,
  retryableFailedTasks,
  type TaskBuckets
} from "./agentPlanClassify.js";
import {
  budgetStopReason,
  persistCtxPlan,
  persistCtxTasks,
  publishRunningSnapshot,
  snapshotFromCtx,
  type PlanShortActs
} from "./agentPlanPersist.js";
import { handleEmptyInFlight, launchReadyTasks } from "./agentPlanLaunch.js";
import { scheduleReadyTasks } from "./planScheduler.js";
import type { InteractiveAgentArgs } from "./chatTurnHelpers.js";
import type { PlanRunContext } from "./agentPlanTypes.js";

export type { PlanRunContext, InFlight } from "./agentPlanTypes.js";

export function createPlanRunContext(opts: {
  args: InteractiveAgentArgs;
  workflowId: string;
  planId: string;
  goal: string;
  tasks: TaskState[];
  short: PlanShortActs;
  planner: Pick<typeof activities, "repairPlan">;
  maxConcurrency: number;
}): PlanRunContext {
  return {
    args: opts.args,
    workflowId: opts.workflowId,
    planId: opts.planId,
    goal: opts.goal,
    version: 1,
    replanCount: 0,
    tasks: opts.tasks,
    workingMs: 0,
    llmTokens: 0,
    costUsd: 0,
    queuedFollowUp: null,
    short: opts.short,
    planStatus: "running",
    inFlight: new Map(),
    pendingAnswer: null,
    cancelRequested: false,
    lastTick: Date.now(),
    rounds: 0,
    toolCallCount: 0,
    finalText: "",
    maxConcurrency: opts.maxConcurrency,
    planner: opts.planner
  };
}

export async function applyChildResult(opts: {
  ctx: PlanRunContext;
  taskId: string;
  result: ExecuteAgentTaskResult;
  worktreePath: string | null;
}): Promise<void> {
  const task = opts.ctx.tasks.find((item) => item.id === opts.taskId);
  if (!task) {
    return;
  }
  task.status = opts.result.status;
  if (opts.result.error) {
    task.error = opts.result.error;
  }
  if (opts.result.waitReason) {
    task.waitReason = opts.result.waitReason as TaskState["waitReason"];
  }
  opts.ctx.rounds += opts.result.rounds;
  opts.ctx.toolCallCount += opts.result.toolCallCount;
  if (opts.result.finalText) {
    opts.ctx.finalText = opts.result.finalText;
  }
  await mergeCompletedWorktree(opts, task);
}

async function mergeCompletedWorktree(
  opts: {
    ctx: PlanRunContext;
    taskId: string;
    result: ExecuteAgentTaskResult;
    worktreePath: string | null;
  },
  task: TaskState
): Promise<void> {
  if (opts.result.status !== "completed" || !opts.worktreePath) {
    return;
  }
  const merge = await opts.ctx.short.mergeTaskWorktree({
    sessionId: opts.ctx.args.sessionId,
    taskId: opts.taskId,
    taskWorktreePath: opts.worktreePath
  });
  if (merge.ok) {
    return;
  }
  task.status = "waiting";
  task.waitReason = {
    kind: "merge_conflict",
    payload: {
      paths: merge.paths ?? [],
      message: merge.message
    }
  };
  await opts.ctx.short.publishMergeConflict({
    turnId: opts.ctx.args.turnId,
    status: "waiting_human",
    paths: merge.paths ?? [],
    originatingTaskIds: [opts.taskId]
  });
}

function tickWorkingMs(ctx: PlanRunContext): void {
  const now = Date.now();
  ctx.workingMs = accrueWorkingMs({
    previousWorkingMs: ctx.workingMs,
    elapsedMs: now - ctx.lastTick,
    workInFlight: ctx.inFlight.size > 0
  });
  ctx.lastTick = now;
}

async function maybeStopBudget(ctx: PlanRunContext): Promise<boolean> {
  const stop = budgetStopReason(ctx);
  if (!stop) {
    return false;
  }
  ctx.planStatus = "failed";
  await persistCtxPlan({
    ctx,
    status: "failed",
    extras: { budgetStopReason: stop },
    budgetStopReason: stop
  });
  await ctx.short.publishPlanStatus({
    turnId: ctx.args.turnId,
    status: "failed",
    reason: stop
  });
  return true;
}

async function maybeApplyAnswer(ctx: PlanRunContext): Promise<void> {
  const answer = ctx.pendingAnswer;
  if (!answer) {
    return;
  }
  ctx.pendingAnswer = null;
  await ctx.short.appendChatMessage({
    sessionId: ctx.args.sessionId,
    role: "user",
    parts: [{ type: "text", text: answer.text }],
    turnId: ctx.args.turnId
  });
  for (const t of ctx.tasks) {
    if (t.status !== "waiting") {
      continue;
    }
    if (answer.taskId && t.id !== answer.taskId) {
      continue;
    }
    t.status = "pending";
    t.waitReason = null;
    t.error = undefined;
    await ctx.short.persistTask({
      planId: ctx.planId,
      version: ctx.version,
      taskId: t.id,
      patch: { status: "pending", waitReason: null, error: null }
    });
    await ctx.short.publishTaskUpdated({
      turnId: ctx.args.turnId,
      task: { id: t.id, status: "pending" }
    });
  }
  ctx.planStatus = "running";
  await ctx.short.publishPlanStatus({
    turnId: ctx.args.turnId,
    status: "running"
  });
}

async function replanFromFailures(opts: {
  ctx: PlanRunContext;
  buckets: TaskBuckets;
}): Promise<void> {
  opts.ctx.replanCount += 1;
  opts.ctx.version += 1;
  const repaired = await opts.ctx.planner.repairPlan({
    sessionId: opts.ctx.args.sessionId,
    turnId: opts.ctx.args.turnId,
    goal: opts.ctx.goal,
    provider: opts.ctx.args.provider,
    model: opts.ctx.args.model,
    draft: {
      goal: opts.ctx.goal,
      tasks: opts.ctx.tasks.map((t) => ({
        id: t.id,
        description: t.description,
        executor: t.executor,
        dependencies: t.dependencies,
        idempotent: t.idempotent
      }))
    },
    errors: opts.buckets.failed.map(
      (t) => `${t.id} failed: ${t.error ?? "unknown"}`
    )
  });
  opts.ctx.goal = repaired.goal;
  opts.ctx.tasks = keepCompletedOnReplan({
    next: draftToTasks(repaired),
    completedIds: opts.buckets.completed
  });
  await persistCtxPlan({ ctx: opts.ctx, status: "running" });
  await persistCtxTasks(opts.ctx);
  await opts.ctx.short.appendPlanChunk({
    turnId: opts.ctx.args.turnId,
    eventType: "replan",
    payload: {
      version: opts.ctx.version,
      replanCount: opts.ctx.replanCount,
      plan: snapshotFromCtx({ ctx: opts.ctx, status: "running" })
    }
  });
}

async function maybeHandleFailed(
  ctx: PlanRunContext,
  buckets: TaskBuckets
): Promise<"break" | "continue" | null> {
  if (
    buckets.failed.length === 0 ||
    ctx.inFlight.size > 0 ||
    buckets.pending.length > 0
  ) {
    return null;
  }
  const retryable = retryableFailedTasks(buckets.failed);
  if (retryable.length > 0) {
    for (const t of retryable) {
      t.status = "pending";
      t.error = undefined;
    }
    return "continue";
  }
  if (ctx.replanCount < MAX_REPLAN_COUNT) {
    await replanFromFailures({ ctx, buckets });
    return "continue";
  }
  ctx.planStatus = "failed";
  return "break";
}

async function maybeParkWait(
  ctx: PlanRunContext,
  buckets: TaskBuckets
): Promise<boolean> {
  if (buckets.waiting.length === 0 || ctx.inFlight.size > 0) {
    return false;
  }
  ctx.planStatus = "waiting";
  await persistCtxPlan({ ctx, status: "waiting" });
  await ctx.short.publishPlanStatus({
    turnId: ctx.args.turnId,
    status: "waiting"
  });
  await condition(() => ctx.pendingAnswer !== null || ctx.cancelRequested);
  return true;
}

async function tickOnce(
  ctx: PlanRunContext
): Promise<"break" | "continue" | "race"> {
  tickWorkingMs(ctx);
  if (await maybeStopBudget(ctx)) {
    return "break";
  }
  await maybeApplyAnswer(ctx);
  const buckets = collectTaskBuckets(ctx.tasks);
  if (
    buckets.pending.length === 0 &&
    ctx.inFlight.size === 0 &&
    buckets.waiting.length === 0 &&
    buckets.failed.length === 0
  ) {
    ctx.planStatus = "completed";
    return "break";
  }
  const failed = await maybeHandleFailed(ctx, buckets);
  if (failed) {
    return failed;
  }
  if (await maybeParkWait(ctx, buckets)) {
    return "continue";
  }
  return finishTick(ctx, buckets);
}

async function finishTick(
  ctx: PlanRunContext,
  buckets: TaskBuckets
): Promise<"break" | "continue" | "race"> {
  const canStartNew = buckets.waiting.length === 0;
  const decision = scheduleReadyTasks({
    tasks: ctx.tasks,
    completed: buckets.completed,
    runningCount: ctx.inFlight.size,
    instanceRunningCount: ctx.inFlight.size,
    maxPerRun: ctx.maxConcurrency
  });
  await launchReadyTasks({
    ctx,
    toStart: canStartNew ? decision.toStart : []
  });
  const empty = await handleEmptyInFlight({
    ctx,
    buckets,
    readyCount: decision.toStart.length
  });
  if (empty) {
    return empty;
  }
  return "race";
}

export async function runPlanExecutionLoop(ctx: PlanRunContext): Promise<void> {
  while (!ctx.cancelRequested) {
    const action = await tickOnce(ctx);
    if (action === "break") {
      break;
    }
    if (action === "continue") {
      continue;
    }
    const finished = await Promise.race(
      [...ctx.inFlight.values()].map((entry) => entry.resultPromise)
    );
    ctx.inFlight.delete(finished.taskId);
    await applyChildResult({ ctx, ...finished });
    await publishRunningSnapshot(ctx);
  }
  if (ctx.cancelRequested) {
    ctx.planStatus = "cancelled";
  }
}
