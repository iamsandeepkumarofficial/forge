import {
  PLAN_SSE_EVENTS,
  PLANNING_GATE_SYSTEM,
  planningGateShortcut,
  resolvePlanningGate,
  type PlanningGateResult,
  type WorkflowPlanDraft,
  type WorkflowPlanSnapshot
} from "@forge/core";
import { api, appendChunk } from "./chatApi.js";
export {
  DEFAULT_GATE_MAX_OUTPUT_TOKENS,
  DEFAULT_PLANNER_MAX_OUTPUT_TOKENS,
  PLANNER_MAX_ATTEMPTS,
  planDraftSchema
} from "./planInvoke.js";
export type { PlanDraftSchema } from "./planInvoke.js";
import {
  DEFAULT_GATE_MAX_OUTPUT_TOKENS,
  callPlannerText,
  invokePlannerWithRetries
} from "./planInvoke.js";

export async function runPlanningGate(input: {
  sessionId: string;
  turnId: string;
  userText: string;
  provider: string;
  model?: string;
  mode?: string;
}): Promise<PlanningGateResult> {
  const early = planningGateShortcut({
    userText: input.userText,
    mode: input.mode
  });
  if (early) return early;

  try {
    const text = await callPlannerText({
      system: PLANNING_GATE_SYSTEM,
      prompt: `User request:\n${input.userText.trim()}\n\nMode: ${input.mode ?? "agent"}`,
      provider: input.provider,
      model: input.model,
      maxOutputTokens: DEFAULT_GATE_MAX_OUTPUT_TOKENS,
      detail: "planningGate"
    });
    return resolvePlanningGate({
      userText: input.userText,
      mode: input.mode,
      llmRaw: text
    });
  } catch {
    return { needsPlanning: false, reason: "gate_error" };
  }
}

export async function createPlan(input: {
  sessionId: string;
  turnId: string;
  goal: string;
  provider: string;
  model?: string;
  mode?: string;
  maxOutputTokens?: number;
}): Promise<WorkflowPlanDraft> {
  return invokePlannerWithRetries({
    provider: input.provider,
    model: input.model,
    detail: "createPlan",
    maxOutputTokens: input.maxOutputTokens,
    buildPrompt: (attempt, lastError) => {
      if (attempt === 1 || !lastError) {
        return `User goal:\n${input.goal}\n\nMode: ${input.mode ?? "agent"}`;
      }
      return [
        `Previous structured plan attempt failed validation or generation.`,
        `Fix the plan for this goal.`,
        `Goal: ${input.goal}`,
        `Mode: ${input.mode ?? "agent"}`,
        `Last error: ${lastError}`
      ].join("\n");
    }
  });
}

export async function repairPlan(input: {
  sessionId: string;
  turnId: string;
  goal: string;
  provider: string;
  model?: string;
  draft: unknown;
  errors: string[];
  maxOutputTokens?: number;
}): Promise<WorkflowPlanDraft> {
  return invokePlannerWithRetries({
    provider: input.provider,
    model: input.model,
    detail: "repairPlan",
    maxOutputTokens: input.maxOutputTokens,
    buildPrompt: (attempt, lastError) => {
      const base = [
        `Replan after execution failure. Produce a valid structured plan.`,
        `Goal: ${input.goal}`,
        `Prior failures:`,
        ...input.errors.map((e) => `- ${e}`),
        `Prior draft JSON:`,
        JSON.stringify(input.draft)
      ];
      if (attempt > 1 && lastError) {
        base.push(`Last planner error: ${lastError}`);
      }
      return base.join("\n");
    }
  });
}

export async function persistPlan(input: {
  id?: string;
  sessionId: string;
  turnId: string;
  workflowId: string;
  goal: string;
  status?: string;
  version?: number;
  replanCount?: number;
  snapshot?: WorkflowPlanSnapshot | Record<string, unknown> | null;
  workingMs?: number;
  llmTokens?: number;
  costUsd?: string;
  budgetStopReason?: string | null;
  queuedFollowUp?: Record<string, unknown> | null;
}): Promise<{ plan: Record<string, unknown> }> {
  const res = await api(`/internal/workflow/plans`, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return (await res.json()) as { plan: Record<string, unknown> };
}

export async function persistTask(input: {
  planId: string;
  version: number;
  taskId: string;
  patch: Record<string, unknown>;
}): Promise<{ task: Record<string, unknown> | null }> {
  const res = await api(
    `/internal/workflow/plans/${encodeURIComponent(input.planId)}/tasks/${encodeURIComponent(input.taskId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        version: input.version,
        ...input.patch
      })
    }
  );
  return (await res.json()) as { task: Record<string, unknown> | null };
}

export async function persistPlanTasks(input: {
  planId: string;
  version: number;
  tasks: Array<{
    id: string;
    description: string;
    executor: "agent" | "tool" | "human";
    dependencies?: string[];
    status?: string;
    idempotent?: boolean;
    input?: unknown;
  }>;
}): Promise<{ tasks: unknown[] }> {
  const res = await api(
    `/internal/workflow/plans/${encodeURIComponent(input.planId)}/tasks`,
    {
      method: "PUT",
      body: JSON.stringify({
        version: input.version,
        tasks: input.tasks
      })
    }
  );
  return (await res.json()) as { tasks: unknown[] };
}

export async function appendPlanChunk(input: {
  turnId: string;
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await appendChunk({
    turnId: input.turnId,
    eventType: input.eventType,
    payload: input.payload
  });
}

export async function publishPlanSnapshot(input: {
  turnId: string;
  snapshot: WorkflowPlanSnapshot | Record<string, unknown>;
}): Promise<void> {
  await appendPlanChunk({
    turnId: input.turnId,
    eventType: PLAN_SSE_EVENTS.planPublished,
    payload: { plan: input.snapshot }
  });
}

export async function publishTaskUpdated(input: {
  turnId: string;
  task: Record<string, unknown>;
}): Promise<void> {
  await appendPlanChunk({
    turnId: input.turnId,
    eventType: PLAN_SSE_EVENTS.taskUpdated,
    payload: { task: input.task }
  });
}

export async function publishPlanStatus(input: {
  turnId: string;
  status: string;
  reason?: string | null;
}): Promise<void> {
  await appendPlanChunk({
    turnId: input.turnId,
    eventType: PLAN_SSE_EVENTS.planStatus,
    payload: {
      status: input.status,
      ...(input.reason ? { reason: input.reason } : {})
    }
  });
}

export async function countRunningAgentTasks(): Promise<number> {
  const res = await api(`/internal/workflow/running-agent-tasks`);
  const body = (await res.json()) as { count: number };
  return Number(body.count ?? 0);
}

export async function getPlanBudget(input: { planId: string }): Promise<{
  workingMs: number;
  llmTokens: number;
  costUsd: number;
}> {
  const res = await api(
    `/internal/workflow/plans/${encodeURIComponent(input.planId)}`
  );
  const body = (await res.json()) as {
    plan: {
      workingMs?: number;
      llmTokens?: number;
      costUsd?: string | number;
    };
  };
  return {
    workingMs: Number(body.plan?.workingMs ?? 0),
    llmTokens: Number(body.plan?.llmTokens ?? 0),
    costUsd: Number(body.plan?.costUsd ?? 0)
  };
}
