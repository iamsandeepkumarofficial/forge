import { startChild, ParentClosePolicy } from "@temporalio/workflow";
import type { ExecutionResult } from "@forge/core";
import type {
  ExecuteAgentTaskArgs,
  ExecuteAgentTaskResult
} from "../executeAgentTaskWorkflow.js";
import type { TaskState } from "../agentWorkflowModel.js";
import type { ExecutorCall, TaskExecutor } from "./types.js";
import type { TaskExecutionContext } from "@forge/core";

export type AgentExecutorDeps = {
  buildChildArgs: (
    task: TaskState,
    context: TaskExecutionContext
  ) => Promise<ExecuteAgentTaskArgs>;
};

export class AgentExecutor implements TaskExecutor {
  constructor(private readonly deps: AgentExecutorDeps) {}

  async execute(call: ExecutorCall): Promise<ExecutionResult> {
    const { task, context } = call;
    const childArgs = await this.deps.buildChildArgs(task, context);
    const handle = await startChild("executeAgentTaskWorkflow", {
      args: [childArgs],
      workflowId: `agent-task-${context.sessionId}-${context.turnId}-${task.id}-${childArgs.attempt}`,
      parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_REQUEST_CANCEL
    });
    const child = (await handle.result()) as ExecuteAgentTaskResult;
    if (child.status === "completed") {
      return {
        kind: "completed",
        output: {
          finalText: child.finalText,
          rounds: child.rounds,
          toolCallCount: child.toolCallCount
        }
      };
    }
    if (child.status === "waiting") {
      return {
        kind: "waiting",
        waitReason: {
          kind: (child.waitReason?.kind as "ask_user") ?? "ask_user",
          payload: {
            ...(typeof child.waitReason?.payload === "object" &&
            child.waitReason?.payload
              ? (child.waitReason.payload as object)
              : {}),
            rounds: child.rounds,
            toolCallCount: child.toolCallCount,
            finalText: child.finalText
          }
        }
      };
    }
    if (child.status === "cancelled") {
      return { kind: "failed", error: child.error ?? "agent task cancelled" };
    }
    return { kind: "failed", error: child.error ?? "agent task failed" };
  }
}
