import type { ExecuteAgentTaskArgs } from "./executeAgentTaskWorkflow.js";
import type { PlanRunContext } from "./agentPlanTypes.js";
import type { TaskState } from "./agentWorkflowModel.js";

async function worktreeForTask(opts: {
  ctx: PlanRunContext;
  task: TaskState;
}): Promise<string | null> {
  if (opts.ctx.maxConcurrency <= 1 || opts.task.executor !== "agent") {
    return null;
  }
  try {
    const wt = await opts.ctx.short.ensureTaskWorktree({
      sessionId: opts.ctx.args.sessionId,
      taskId: opts.task.id
    });
    return wt.worktreePath;
  } catch {
    return null;
  }
}

export async function buildAgentChildArgs(opts: {
  ctx: PlanRunContext;
  task: TaskState;
}): Promise<ExecuteAgentTaskArgs> {
  const worktreePath = await worktreeForTask(opts);
  opts.task.worktreePath = worktreePath;
  return {
    sessionId: opts.ctx.args.sessionId,
    turnId: opts.ctx.args.turnId,
    planId: opts.ctx.planId,
    planVersion: opts.ctx.version,
    taskId: opts.task.id,
    description: opts.task.description,
    provider: opts.ctx.args.provider,
    model: opts.ctx.args.model,
    reasoningEffort: opts.ctx.args.reasoningEffort,
    mode: opts.ctx.args.mode,
    attempt: opts.task.attemptCount,
    worktreePath
  };
}
