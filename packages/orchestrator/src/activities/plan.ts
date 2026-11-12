import {
  PLAN_SSE_EVENTS,
  chatToolCatalogIds,
  type WorkflowPlanDraft,
  type WorkflowPlanSnapshot
} from "@forge/core";
import { api, appendChunk, loadChatMessages } from "./chatApi.js";
import { executeNamedTool } from "../tools.js";
import { formatPlannerChatExcerpt } from "./planningGateRun.js";
export {
  DEFAULT_GATE_MAX_OUTPUT_TOKENS,
  DEFAULT_PLANNER_MAX_OUTPUT_TOKENS,
  PLANNER_MAX_ATTEMPTS,
  planDraftSchema,
  coercePlannerTaskDraft
} from "./planInvoke.js";
export type { PlanDraftSchema } from "./planInvoke.js";
import { invokePlannerWithRetries } from "./planInvoke.js";

export {
  formatPlannerChatExcerpt,
  runPlanningGate
} from "./planningGateRun.js";

export async function createPlan(input: {
  sessionId: string;
  turnId: string;
  goal: string;
  provider: string;
  model?: string;
  mode?: string;
  maxOutputTokens?: number;
}): Promise<WorkflowPlanDraft> {
  let chatExcerpt = "";
  try {
    const messages = await loadChatMessages(input.sessionId);
    chatExcerpt = formatPlannerChatExcerpt(messages);
  } catch {
    chatExcerpt = "";
  }
  return invokePlannerWithRetries({
    provider: input.provider,
    model: input.model,
    detail: "createPlan",
    maxOutputTokens: input.maxOutputTokens,
    buildPrompt: (attempt, lastError) => {
      const parts = [
        `User goal:\n${input.goal}`,
        `Mode: ${input.mode ?? "agent"}`
      ];
      if (chatExcerpt) {
        parts.push(`Recent chat (ground narrative sections):\n${chatExcerpt}`);
      }
      if (attempt === 1 || !lastError) {
        return parts.join("\n\n");
      }
      return [
        `Previous structured plan attempt failed validation or generation.`,
        `Fix the plan for this goal.`,
        ...parts,
        `Last error: ${lastError}`
      ].join("\n\n");
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
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    inputMappings?: Array<Record<string, unknown>>;
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

export async function executeDirectTool(input: {
  sessionId: string;
  turnId: string;
  toolName: string;
  args?: Record<string, unknown>;
  agentMode?: string | null;
}): Promise<{
  success: boolean;
  output: string;
  error?: string;
  unknownTool?: boolean;
}> {
  const known = new Set(chatToolCatalogIds());
  if (!known.has(input.toolName)) {
    return {
      success: false,
      output: "",
      error: `unknown tool: ${input.toolName}`,
      unknownTool: true
    };
  }
  const result = await executeNamedTool({
    sessionId: input.sessionId,
    toolName: input.toolName,
    args: input.args ?? {},
    turnId: input.turnId,
    agentMode: input.agentMode
  });
  return {
    success: result.success,
    output: result.output,
    ...(result.success
      ? {}
      : { error: result.output || `tool ${input.toolName} failed` })
  };
}
