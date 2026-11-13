import type {
  ExecutionResult,
  PlanSection,
  QueuedFollowUp,
  WorkflowPlanSnapshot
} from "@forge/core";
import type * as activities from "../activities/index.js";
import type { TaskState } from "./agentWorkflowModel.js";
import type { PlanShortActs } from "./agentPlanPersist.js";
import type { InteractiveAgentArgs } from "./chatTurnHelpers.js";
import type { ExecutorRegistry } from "./executors/index.js";

export type InFlight = {
  taskId: string;
  worktreePath: string | null;
  resultPromise: Promise<{
    taskId: string;
    result: ExecutionResult;
    worktreePath: string | null;
  }>;
};

export type PlanReactActs = {
  short: Pick<
    typeof activities,
    "loadChatMessages" | "appendChatMessage" | "rejectChatToolCall"
  >;
  llm: Pick<typeof activities, "runLlmStep">;
  tools: Pick<typeof activities, "executeChatTool">;
};

export type PlanRunContext = {
  args: InteractiveAgentArgs;
  workflowId: string;
  planId: string;
  goal: string;
  sections?: PlanSection[];
  version: number;
  replanCount: number;
  tasks: TaskState[];
  workingMs: number;
  llmTokens: number;
  costUsd: number;
  queuedFollowUp: QueuedFollowUp | null;
  short: PlanShortActs;
  planStatus: WorkflowPlanSnapshot["status"];
  inFlight: Map<string, InFlight>;
  pendingAnswer: {
    text?: string;
    taskId?: string;
    decision?: string;
    payload?: unknown;
  } | null;

  buildRequested: boolean;
  cancelRequested: boolean;
  lastTick: number;
  rounds: number;
  toolCallCount: number;
  finalText: string;
  maxConcurrency: number;
  planner: Pick<typeof activities, "repairPlan">;
  registry: ExecutorRegistry;
  tools: Pick<typeof activities, "executeDirectTool">;

  react?: PlanReactActs;

  forceChildIsolation?: boolean;
};
