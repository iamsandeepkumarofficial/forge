import type { ExecuteAgentTaskArgs } from "./executeAgentTaskWorkflow.js";
import type { PlanRunContext } from "./agentPlanTypes.js";
import type { TaskState } from "./agentWorkflowModel.js";
import { buildTaskBrief } from "./taskBrief.js";

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

export async function ensureTaskStreamTurn(opts: {
  ctx: PlanRunContext;
  task: TaskState;
}): Promise<string | null> {
  if (opts.task.executor !== "agent") {
    return null;
  }

  if (opts.task.streamTurnId) {
    return opts.task.streamTurnId;
  }
  const created = await opts.ctx.short.createTaskStreamTurn({
    sessionId: opts.ctx.args.sessionId,
    planId: opts.ctx.planId,
    taskId: opts.task.id,
    attempt: opts.task.attemptCount,
    provider: opts.ctx.args.provider,
    model: opts.ctx.args.model
  });
  opts.task.streamTurnId = created.turnId;
  return created.turnId;
}

export async function buildAgentChildArgs(opts: {
  ctx: PlanRunContext;
  task: TaskState;
}): Promise<ExecuteAgentTaskArgs> {
  const worktreePath = await worktreeForTask(opts);
  opts.task.worktreePath = worktreePath;
  const streamTurnId =
    opts.task.streamTurnId ?? (await ensureTaskStreamTurn(opts));
  const brief = buildTaskBrief({
    voice: "child",
    goal: opts.ctx.goal,
    sections: opts.ctx.sections,
    taskId: opts.task.id,
    description: opts.task.description,
    rationale: opts.task.rationale,
    input: opts.task.input ?? {},
    outputSchema: opts.task.outputSchema
  });
  return {
    sessionId: opts.ctx.args.sessionId,
    turnId: opts.ctx.args.turnId,
    planId: opts.ctx.planId,
    planVersion: opts.ctx.version,
    taskId: opts.task.id,
    description: brief,
    input: opts.task.input ?? {},
    outputSchema: opts.task.outputSchema as Record<string, unknown>,
    provider: opts.ctx.args.provider,
    model: opts.ctx.args.model,
    reasoningEffort: opts.ctx.args.reasoningEffort,
    mode: opts.ctx.args.mode,
    attempt: opts.task.attemptCount,
    worktreePath,

    quiet: true,
    ...(streamTurnId ? { streamTurnId } : {})
  };
}
