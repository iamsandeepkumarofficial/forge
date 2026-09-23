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
    return { kind: "completed", output: call.payload };
  }
}
