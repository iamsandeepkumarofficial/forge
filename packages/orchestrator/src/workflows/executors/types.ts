import type {
  ExecutionResult,
  TaskExecutionContext,
  TaskWaitReason
} from "@forge/core";
import type { TaskState } from "../agentWorkflowModel.js";

export type { ExecutionResult, TaskExecutionContext };

export type ExecutorCall = {
  task: TaskState;
  context: TaskExecutionContext;
};

export type ExecutorResumeCall = ExecutorCall & {
  payload: unknown;
};

export interface TaskExecutor {
  execute(call: ExecutorCall): Promise<ExecutionResult>;
}

export interface ResumableExecutor extends TaskExecutor {
  resume(call: ExecutorResumeCall): Promise<ExecutionResult>;
}

export function isResumableExecutor(
  executor: TaskExecutor
): executor is ResumableExecutor {
  return typeof (executor as ResumableExecutor).resume === "function";
}

export type HumanDecision = "approve" | "reject" | "skip";

export function decisionOf(payload: unknown): HumanDecision {
  if (payload && typeof payload === "object") {
    const decision = (payload as { decision?: unknown }).decision;
    if (
      decision === "reject" ||
      decision === "skip" ||
      decision === "approve"
    ) {
      return decision;
    }
  }
  return "approve";
}

export function toolNameFromInput(input: unknown): string | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const toolName = (input as { toolName?: unknown }).toolName;
  return typeof toolName === "string" && toolName.trim()
    ? toolName.trim()
    : null;
}

export function toolArgsFromInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    return {};
  }
  const args = (input as { args?: unknown }).args;
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return {};
}

export function toolNeedsApproval(toolName: string): boolean {
  return /install|deploy|rm\b|delete|drop|migrate|switch_mode/i.test(toolName);
}

export function waitingApproval(payload?: unknown): ExecutionResult {
  return {
    kind: "waiting",
    waitReason: {
      kind: "approval",
      payload
    } satisfies TaskWaitReason
  };
}
