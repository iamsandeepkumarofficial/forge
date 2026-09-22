import type { QueuedFollowUp, WorkflowPlanSnapshot } from "@forge/core";
import type * as activities from "../activities/index.js";
import type { ExecuteAgentTaskResult } from "./executeAgentTaskWorkflow.js";
import type { TaskState } from "./agentWorkflowModel.js";
import type { PlanShortActs } from "./agentPlanPersist.js";
import type { InteractiveAgentArgs } from "./chatTurnHelpers.js";

export type InFlight = {
  taskId: string;
  worktreePath: string | null;
  resultPromise: Promise<{
    taskId: string;
    result: ExecuteAgentTaskResult;
    worktreePath: string | null;
  }>;
};

export type PlanRunContext = {
  args: InteractiveAgentArgs;
  workflowId: string;
  planId: string;
  goal: string;
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
  pendingAnswer: { text: string; taskId?: string } | null;
  cancelRequested: boolean;
  lastTick: number;
  rounds: number;
  toolCallCount: number;
  finalText: string;
  maxConcurrency: number;
  planner: Pick<typeof activities, "repairPlan">;
};
