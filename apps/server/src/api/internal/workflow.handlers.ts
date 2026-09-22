import type { Request, Response } from "express";
import { WorkflowPlanRepository } from "../../catalog/workflowPlanRepository.js";
import { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import {
  ensureTaskWorktree,
  mergeTaskWorktree,
  worktreeWorkDir
} from "../../projects/localWorktree.js";
import type { WorkflowPlan, WorkflowTask } from "@forge/db";

const N_400 = 400;
const N_404 = 404;
const N_500 = 500;

function repo() {
  return new WorkflowPlanRepository();
}

export async function handleCreateOrUpdatePlan(options: {
  req: Request;
  res: Response;
}): Promise<void> {
  const { req, res } = options;
  const body = req.body as Record<string, unknown>;
  try {
    const sessionId = String(body.sessionId ?? "");
    const turnId = String(body.turnId ?? "");
    const workflowId = String(body.workflowId ?? "");
    const goal = String(body.goal ?? "");
    if (!sessionId || !turnId || !workflowId || !goal) {
      res.status(N_400).json({
        error: "sessionId, turnId, workflowId, and goal are required"
      });
      return;
    }
    const existing = await repo().getByTurnId(turnId);
    let plan: WorkflowPlan;
    if (existing) {
      const updated = await repo().update(existing.id, {
        goal,
        status: (body.status as WorkflowPlan["status"]) ?? undefined,
        version: typeof body.version === "number" ? body.version : undefined,
        replanCount:
          typeof body.replanCount === "number" ? body.replanCount : undefined,
        snapshot:
          body.snapshot === undefined
            ? undefined
            : ((body.snapshot as Record<string, unknown> | null) ?? null),
        workingMs:
          typeof body.workingMs === "number" ? body.workingMs : undefined,
        llmTokens:
          typeof body.llmTokens === "number" ? body.llmTokens : undefined,
        costUsd:
          typeof body.costUsd === "string" || typeof body.costUsd === "number"
            ? String(body.costUsd)
            : undefined,
        budgetStopReason:
          body.budgetStopReason === undefined
            ? undefined
            : body.budgetStopReason === null
              ? null
              : String(body.budgetStopReason),
        queuedFollowUp:
          body.queuedFollowUp === undefined
            ? undefined
            : ((body.queuedFollowUp as WorkflowPlan["queuedFollowUp"]) ?? null)
      });
      plan = updated ?? existing;
    } else {
      plan = await repo().create({
        id: typeof body.id === "string" ? body.id : undefined,
        sessionId,
        turnId,
        workflowId,
        goal,
        status: (body.status as WorkflowPlan["status"]) ?? "planned",
        version: typeof body.version === "number" ? body.version : 1,
        snapshot:
          (body.snapshot as Record<string, unknown> | null | undefined) ?? null
      });
    }
    res.json({ plan });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleGetPlan(options: {
  req: Request;
  res: Response;
}): Promise<void> {
  const { req, res } = options;
  try {
    const planId = String(req.params.planId ?? "");
    const plan = await repo().getById(planId);
    if (!plan) {
      res.status(N_404).json({ error: "plan not found" });
      return;
    }
    const tasks = await repo().listTasks(plan.id, plan.version);
    res.json({ plan, tasks });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handlePutPlanTasks(options: {
  req: Request;
  res: Response;
}): Promise<void> {
  const { req, res } = options;
  try {
    const planId = String(req.params.planId ?? "");
    const body = req.body as {
      version?: number;
      tasks?: Array<{
        id: string;
        description: string;
        executor: WorkflowTask["executor"];
        dependencies?: string[];
        status?: WorkflowTask["status"];
        idempotent?: boolean;
        input?: unknown;
      }>;
    };
    const version = body.version ?? 1;
    const tasks = Array.isArray(body.tasks) ? body.tasks : [];
    const rows = await repo().upsertTasks({ planId, version, tasks });
    res.json({ tasks: rows });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handlePatchPlanTask(options: {
  req: Request;
  res: Response;
}): Promise<void> {
  const { req, res } = options;
  try {
    const planId = String(req.params.planId ?? "");
    const taskId = String(req.params.taskId ?? "");
    const body = req.body as Record<string, unknown>;
    const version =
      typeof body.version === "number"
        ? body.version
        : Number(body.version ?? 1);
    const task = await repo().updateTask({
      planId,
      version,
      taskId,
      patch: {
        status: body.status as WorkflowTask["status"] | undefined,
        waitReason:
          body.waitReason === undefined
            ? undefined
            : ((body.waitReason as Record<string, unknown> | null) ?? null),
        output: body.output,
        error:
          body.error === undefined
            ? undefined
            : body.error === null
              ? null
              : String(body.error),
        attemptCount:
          typeof body.attemptCount === "number" ? body.attemptCount : undefined,
        childWorkflowId:
          body.childWorkflowId === undefined
            ? undefined
            : body.childWorkflowId === null
              ? null
              : String(body.childWorkflowId),
        worktreePath:
          body.worktreePath === undefined
            ? undefined
            : body.worktreePath === null
              ? null
              : String(body.worktreePath),
        startedAt:
          body.startedAt === undefined
            ? undefined
            : body.startedAt
              ? new Date(String(body.startedAt))
              : null,
        finishedAt:
          body.finishedAt === undefined
            ? undefined
            : body.finishedAt
              ? new Date(String(body.finishedAt))
              : null
      }
    });
    res.json({ task });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleCountRunningAgentTasks(options: {
  res: Response;
}): Promise<void> {
  try {
    const count = await repo().countRunningAgentTasks();
    options.res.json({ count });
  } catch (err) {
    options.res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleEnsureTaskWorktree(options: {
  req: Request;
  res: Response;
}): Promise<void> {
  const { req, res } = options;
  try {
    const sessionId = String(req.body?.sessionId ?? "");
    const taskId = String(req.body?.taskId ?? "");
    if (!sessionId || !taskId) {
      res.status(N_400).json({ error: "sessionId and taskId required" });
      return;
    }
    const features = new ChatFeatureRepository();
    const card = await features.getBySessionId(sessionId);
    const projectId = card?.projectId ?? "unknown";
    const sessionWorkDir = worktreeWorkDir(projectId, sessionId);
    const result = await ensureTaskWorktree({ sessionWorkDir, taskId });
    res.json(result);
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleMergeTaskWorktree(options: {
  req: Request;
  res: Response;
}): Promise<void> {
  const { req, res } = options;
  try {
    const sessionId = String(req.body?.sessionId ?? "");
    const taskWorktreePath = String(req.body?.taskWorktreePath ?? "");
    if (!sessionId || !taskWorktreePath) {
      res
        .status(N_400)
        .json({ error: "sessionId and taskWorktreePath required" });
      return;
    }
    const features = new ChatFeatureRepository();
    const card = await features.getBySessionId(sessionId);
    const projectId = card?.projectId ?? "unknown";
    const sessionWorkDir = worktreeWorkDir(projectId, sessionId);
    const result = await mergeTaskWorktree({
      sessionWorkDir,
      taskWorktreePath
    });
    res.json(result);
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}
