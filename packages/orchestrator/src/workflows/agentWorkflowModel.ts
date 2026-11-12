import {
  MAX_EXECUTION_TIME_MS,
  MAX_LLM_TOKENS,
  MAX_COST_USD,
  type WorkflowPlanDraft,
  type WorkflowPlanSnapshot,
  type WorkflowTaskSnapshot,
  type TaskStatus
} from "@forge/core";
import type { ChatAgentMode } from "./chatTurnHelpers.js";

export type TaskState = WorkflowTaskSnapshot & {
  attemptCount: number;
  worktreePath?: string | null;

  streamTurnId?: string | null;
  input?: unknown;
  output?: unknown;
};

export function toSnapshot(opts: {
  planId: string;
  goal: string;
  status: WorkflowPlanSnapshot["status"];
  version: number;
  replanCount: number;
  tasks: TaskState[];
  extras?: Partial<WorkflowPlanSnapshot>;
  sections?: WorkflowPlanSnapshot["sections"];
}): WorkflowPlanSnapshot {
  const sections = opts.sections ?? opts.extras?.sections;
  return {
    id: opts.planId,
    goal: opts.goal,
    ...(sections?.length ? { sections } : {}),
    status: opts.status,
    version: opts.version,
    replanCount: opts.replanCount,
    queuedFollowUp: opts.extras?.queuedFollowUp ?? null,
    workingMs: opts.extras?.workingMs ?? 0,
    llmTokens: opts.extras?.llmTokens ?? 0,
    costUsd: opts.extras?.costUsd ?? 0,
    budget: {
      maxExecutionTimeMs: MAX_EXECUTION_TIME_MS,
      maxLLMTokens: MAX_LLM_TOKENS,
      maxCostUsd: MAX_COST_USD
    },
    budgetStopReason: opts.extras?.budgetStopReason ?? null,
    tasks: opts.tasks.map((t) => ({
      id: t.id,
      description: t.description,
      executor: t.executor,
      dependencies: t.dependencies,
      status: t.status,
      idempotent: t.idempotent,
      attemptCount: t.attemptCount,
      waitReason: t.waitReason,
      error: t.error,
      ...(t.isolation ? { isolation: t.isolation } : {}),
      ...(t.rationale ? { rationale: t.rationale } : {}),
      inputSchema: t.inputSchema,
      outputSchema: t.outputSchema,
      ...(t.inputMappings?.length ? { inputMappings: t.inputMappings } : {})
    }))
  };
}

export function draftToTasks(draft: WorkflowPlanDraft): TaskState[] {
  return draft.tasks.map((t) => ({
    id: t.id,
    description: t.description,
    executor: t.executor,
    dependencies: t.dependencies ?? [],
    status: "pending" as TaskStatus,
    idempotent: t.idempotent ?? false,
    attemptCount: 0,
    waitReason: null,
    ...(t.isolation ? { isolation: t.isolation } : {}),
    ...(t.rationale ? { rationale: t.rationale } : {}),
    inputSchema: t.inputSchema,
    outputSchema: t.outputSchema,
    ...(t.inputMappings?.length ? { inputMappings: t.inputMappings } : {}),
    ...(t.input !== undefined ? { input: t.input } : {})
  }));
}

export function isMutatingMode(mode: ChatAgentMode): boolean {
  return mode !== "plan" && mode !== "ask";
}
