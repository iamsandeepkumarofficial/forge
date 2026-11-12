import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import type { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import { WorkflowPlanRepository } from "../../catalog/workflowPlanRepository.js";

const N_404 = 404;
const N_500 = 500;

export async function planJsonWithLiveTasks(
  plans: WorkflowPlanRepository,
  row: {
    id: string;
    goal: string;
    status: string;
    version: number;
    replanCount?: number;
    workingMs?: number;
    llmTokens?: number;
    costUsd?: string | number;
    queuedFollowUp?: unknown;
    budgetStopReason?: string | null;
    snapshot?: Record<string, unknown> | null;
  }
): Promise<Record<string, unknown>> {
  const tasks = await plans.listTasks(row.id, row.version);
  const liveTasks = tasks.map((t) => ({
    id: t.id,
    description: t.description,
    executor: t.executor,
    dependencies: t.dependencies,
    status: t.status,
    idempotent: t.idempotent,
    attemptCount: t.attemptCount,
    waitReason: t.waitReason,
    error: t.error,
    ...(t.streamTurnId ? { streamTurnId: t.streamTurnId } : {}),
    ...(t.outputSchema ? { outputSchema: t.outputSchema } : {})
  }));
  const base =
    row.snapshot && typeof row.snapshot === "object"
      ? { ...row.snapshot }
      : {
          id: row.id,
          goal: row.goal,
          status: row.status,
          version: row.version,
          replanCount: row.replanCount,
          workingMs: row.workingMs,
          llmTokens: row.llmTokens,
          costUsd: Number(row.costUsd ?? 0),
          queuedFollowUp: row.queuedFollowUp,
          budgetStopReason: row.budgetStopReason
        };
  return {
    ...base,
    status: row.status,
    version: row.version,
    tasks: liveTasks
  };
}

export async function handleGetCurrentPlan(options: {
  req: Request;
  res: Response;
  features: ChatFeatureRepository;
}): Promise<void> {
  const { req, res, features } = options;
  const sessionId = String(req.params.sessionId ?? "");
  const userId = (req as AuthedRequest).forgeUser.id;
  try {
    const card = await features.getBySessionId(sessionId);
    if (card && card.userId !== userId) {
      res.status(N_404).json({ error: "session not found" });
      return;
    }
    const plans = new WorkflowPlanRepository();
    const plan = await plans.getCurrentBySessionId(sessionId);
    if (!plan) {
      res.json({ plan: null, tasks: [] });
      return;
    }
    const tasks = await plans.listTasks(plan.id, plan.version);
    res.json({
      plan: await planJsonWithLiveTasks(plans, plan),
      tasks
    });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}
