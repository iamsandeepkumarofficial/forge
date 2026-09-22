import { startChild, sleep, ParentClosePolicy } from "@temporalio/workflow";
import type {
  ExecuteAgentTaskArgs,
  ExecuteAgentTaskResult
} from "./executeAgentTaskWorkflow.js";
import type { TaskBuckets } from "./agentPlanClassify.js";
import type { PlanRunContext } from "./agentPlanTypes.js";
import type { TaskState } from "./agentWorkflowModel.js";

const STALL_SLEEP = "2 seconds";

async function parkHumanTask(opts: {
  ctx: PlanRunContext;
  task: TaskState;
}): Promise<void> {
  opts.task.status = "waiting";
  opts.task.waitReason = {
    kind: "approval",
    payload: { description: opts.task.description }
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
  await opts.ctx.short.publishTaskUpdated({
    turnId: opts.ctx.args.turnId,
    task: {
      id: opts.task.id,
      status: "waiting",
      waitReason: opts.task.waitReason
    }
  });
}

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

async function launchAgentTask(opts: {
  ctx: PlanRunContext;
  task: TaskState;
}): Promise<void> {
  opts.task.status = "running";
  opts.task.attemptCount += 1;
  const worktreePath = await worktreeForTask(opts);
  const childArgs: ExecuteAgentTaskArgs = {
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
  const handle = await startChild("executeAgentTaskWorkflow", {
    args: [childArgs],
    workflowId: `agent-task-${opts.ctx.args.sessionId}-${opts.ctx.args.turnId}-${opts.task.id}-${opts.task.attemptCount}`,
    parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_REQUEST_CANCEL
  });
  const resultPromise = handle.result().then((result) => ({
    taskId: opts.task.id,
    result: result as ExecuteAgentTaskResult,
    worktreePath
  }));
  opts.ctx.inFlight.set(opts.task.id, {
    taskId: opts.task.id,
    worktreePath,
    resultPromise
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
    if (task.executor === "human") {
      await parkHumanTask({ ctx: opts.ctx, task });
      continue;
    }
    await launchAgentTask({ ctx: opts.ctx, task });
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
