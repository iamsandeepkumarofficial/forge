import {
  checkBudget,
  type QueuedFollowUp,
  type WorkflowPlanSnapshot
} from "@forge/core";
import type * as activities from "../activities/index.js";
import { toSnapshot, type TaskState } from "./agentWorkflowModel.js";
import type { InteractiveAgentArgs } from "./chatTurnHelpers.js";
import { tasksForPersist } from "./agentPlanClassify.js";

export type PlanShortActs = Pick<
  typeof activities,
  | "persistPlan"
  | "persistPlanTasks"
  | "persistTask"
  | "publishPlanSnapshot"
  | "publishPlanStatus"
  | "publishTaskUpdated"
  | "publishMergeConflict"
  | "appendPlanChunk"
  | "appendChatMessage"
  | "mergeTaskWorktree"
  | "ensureTaskWorktree"
>;

export type PlanPersistCtx = {
  args: InteractiveAgentArgs;
  workflowId: string;
  planId: string;
  goal: string;
  version: number;
  replanCount: number;
  tasks: TaskState[];
  workingMs: number;
  llmTokens: number;
  costUsd: number;
  queuedFollowUp: QueuedFollowUp | null;
  short: PlanShortActs;
};

export function snapshotFromCtx(opts: {
  ctx: PlanPersistCtx;
  status: WorkflowPlanSnapshot["status"];
  extras?: Partial<WorkflowPlanSnapshot>;
}): WorkflowPlanSnapshot {
  return toSnapshot({
    planId: opts.ctx.planId,
    goal: opts.ctx.goal,
    status: opts.status,
    version: opts.ctx.version,
    replanCount: opts.ctx.replanCount,
    tasks: opts.ctx.tasks,
    extras: {
      workingMs: opts.ctx.workingMs,
      llmTokens: opts.ctx.llmTokens,
      costUsd: opts.ctx.costUsd,
      queuedFollowUp: opts.ctx.queuedFollowUp,
      ...opts.extras
    }
  });
}

export async function persistCtxPlan(opts: {
  ctx: PlanPersistCtx;
  status: WorkflowPlanSnapshot["status"];
  extras?: Partial<WorkflowPlanSnapshot>;
  budgetStopReason?: string | null;
}): Promise<WorkflowPlanSnapshot> {
  const snapshot = snapshotFromCtx({
    ctx: opts.ctx,
    status: opts.status,
    extras: opts.extras
  });
  await opts.ctx.short.persistPlan({
    sessionId: opts.ctx.args.sessionId,
    turnId: opts.ctx.args.turnId,
    workflowId: opts.ctx.workflowId,
    goal: opts.ctx.goal,
    status: opts.status,
    version: opts.ctx.version,
    replanCount: opts.ctx.replanCount,
    workingMs: opts.ctx.workingMs,
    queuedFollowUp: opts.ctx.queuedFollowUp,
    budgetStopReason: opts.budgetStopReason,
    snapshot
  });
  return snapshot;
}

export async function persistCtxTasks(ctx: PlanPersistCtx): Promise<void> {
  await ctx.short.persistPlanTasks({
    planId: ctx.planId,
    version: ctx.version,
    tasks: tasksForPersist(ctx.tasks)
  });
}

export async function publishRunningSnapshot(
  ctx: PlanPersistCtx
): Promise<void> {
  const snapshot = await persistCtxPlan({ ctx, status: "running" });
  await ctx.short.publishPlanSnapshot({
    turnId: ctx.args.turnId,
    snapshot
  });
}

export function budgetStopReason(ctx: PlanPersistCtx): string | null {
  return checkBudget({
    workingMs: ctx.workingMs,
    llmTokens: ctx.llmTokens,
    costUsd: ctx.costUsd
  });
}
