import type { ExecutionResult } from "@forge/core";
import {
  decisionOf,
  waitingApproval,
  type ExecutorCall,
  type ExecutorResumeCall,
  type ResumableExecutor
} from "./types.js";

export class HumanExecutor implements ResumableExecutor {
  async execute(call: ExecutorCall): Promise<ExecutionResult> {
    return waitingApproval({ description: call.task.description });
  }

  async resume(call: ExecutorResumeCall): Promise<ExecutionResult> {
    const decision = decisionOf(call.payload);
    if (decision === "reject" || decision === "skip") {
      return { kind: "failed", error: decision };
    }
    return {
      kind: "completed",
      output: { kind: "value", value: humanOutputValue(call.payload) }
    };
  }
}

export function humanOutputValue(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload ?? {};
  }
  const bag = payload as Record<string, unknown>;
  if ("payload" in bag) {
    return bag.payload;
  }
  const keys = Object.keys(bag);
  if (
    keys.length > 0 &&
    keys.every((k) => k === "decision" || k === "text" || k === "toolName")
  ) {
    return {};
  }
  return bag;
}
