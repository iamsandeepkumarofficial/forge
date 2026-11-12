export const MAX_TASKS_PER_PLAN_VERSION = 20;

export const MAX_PLAN_SECTIONS = 8;
export const MAX_AGENTS_PER_RUN = 4;
export const MAX_AGENTS_PER_INSTANCE = 10;
export const MAX_TASK_ATTEMPTS = 3;
export const MAX_REPLAN_COUNT = 2;
export const MAX_CONFLICT_RESOLVER_ATTEMPTS = 2;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const BUDGET_MINUTES = 30;
export const MAX_EXECUTION_TIME_MS =
  BUDGET_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;
export const MAX_LLM_TOKENS = 500_000;
export const MAX_COST_USD = 3;

export type {
  TaskSchema,
  TaskSchemaNode,
  InputMapping,
  TaskOutput,
  ArtifactMetadata
} from "./schemas/schema-types.js";
export {
  TASK_SCHEMA_FORMAT_VERSION,
  MAX_TASK_SCHEMA_BYTES,
  MAX_TASK_SCHEMA_DEPTH,
  MAX_TASK_SCHEMA_PROPERTIES,
  MAX_TASK_SCHEMA_ENUM_VALUES,
  MAX_TASK_SCHEMA_DESCRIPTION_CHARS,
  MAX_INLINE_TASK_OUTPUT_BYTES,
  emptyObjectSchema
} from "./schemas/schema-types.js";

import type {
  InputMapping,
  TaskOutput,
  TaskSchema
} from "./schemas/schema-types.js";

export const PLAN_STATUSES = [
  "planned",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled"
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const TASK_STATUSES = [
  "pending",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled"
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_EXECUTORS = ["agent", "tool", "human"] as const;
export type TaskExecutor = (typeof TASK_EXECUTORS)[number];

export const TASK_ISOLATIONS = ["inline", "child"] as const;
export type TaskIsolation = (typeof TASK_ISOLATIONS)[number];

export const BUDGET_STOP_REASONS = ["time", "tokens", "cost"] as const;
export type BudgetStopReason = (typeof BUDGET_STOP_REASONS)[number];

export type WorkflowTaskDraft = {
  id: string;
  description: string;
  executor: TaskExecutor;
  dependencies?: string[];
  idempotent?: boolean;

  isolation?: TaskIsolation;

  rationale?: string;
  input?: unknown;
  inputSchema: TaskSchema;
  outputSchema: TaskSchema;
  inputMappings?: InputMapping[];
};

export type PlanSection = {
  title: string;
  body: string;
};

export type WorkflowPlanDraft = {
  goal: string;

  sections?: PlanSection[];
  tasks: WorkflowTaskDraft[];
};

export type QueuedFollowUp = {
  text: string;
  mode?: string;
  provider?: string;
  model?: string;
  reasoningEffort?: string;
};

export type TaskWaitReason = {
  kind: "ask_user" | "mode_switch" | "approval" | "merge_conflict";
  payload?: unknown;
};

export type WorkflowTaskSnapshot = {
  id: string;
  description: string;
  executor: TaskExecutor;
  dependencies: string[];
  status: TaskStatus;
  idempotent: boolean;
  attemptCount: number;
  waitReason: TaskWaitReason | null;
  error?: string | null;
  isolation?: TaskIsolation;
  rationale?: string;
  input?: unknown;
  output?: TaskOutput | unknown;
  inputSchema: TaskSchema;
  outputSchema: TaskSchema;
  inputMappings?: InputMapping[];
};

export type TaskExecutionContext = {
  workflowId: string;
  sessionId: string;
  turnId: string;
  planId: string;
  taskId: string;

  input: unknown;
};

export type ExecutionResult =
  | { kind: "waiting"; waitReason: TaskWaitReason }
  | {
      kind: "completed";
      output: TaskOutput;
      metrics?: { rounds?: number; toolCallCount?: number };
    }
  | { kind: "failed"; error: string };

export type WorkflowPlanSnapshot = {
  id: string;
  goal: string;
  sections?: PlanSection[];
  status: PlanStatus;
  version: number;
  replanCount: number;
  queuedFollowUp: QueuedFollowUp | null;
  workingMs: number;
  llmTokens: number;
  costUsd: number;
  budget: {
    maxExecutionTimeMs: number;
    maxLLMTokens: number;
    maxCostUsd: number;
  };
  budgetStopReason?: BudgetStopReason | null;
  tasks: WorkflowTaskSnapshot[];
};
