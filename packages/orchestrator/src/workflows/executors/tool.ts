import type { ExecutionResult } from "@forge/core";
import {
  decisionOf,
  toolArgsFromInput,
  toolNameFromInput,
  toolNeedsApproval,
  waitingApproval,
  type ExecutorCall,
  type ExecutorResumeCall,
  type ResumableExecutor
} from "./types.js";
import { normalizeRawToolResult } from "./normalizeToolResult.js";

export type ExecuteDirectToolFn = (input: {
  sessionId: string;
  turnId: string;
  toolName: string;
  args: Record<string, unknown>;
  agentMode?: string | null;
}) => Promise<{
  success: boolean;
  output: string;
  error?: string;
  unknownTool?: boolean;
}>;

export class ToolExecutor implements ResumableExecutor {
  constructor(private readonly executeDirectTool: ExecuteDirectToolFn) {}

  private toolInput(call: ExecutorCall): unknown {
    if (toolNameFromInput(call.context.input)) {
      return call.context.input;
    }
    return call.task.input ?? call.context.input ?? {};
  }

  async execute(call: ExecutorCall): Promise<ExecutionResult> {
    const input = this.toolInput(call);
    const toolName = toolNameFromInput(input);
    if (!toolName) {
      return {
        kind: "failed",
        error: "tool task missing input.toolName"
      };
    }
    if (toolNeedsApproval(toolName)) {
      return waitingApproval({
        description: call.task.description,
        toolName,
        args: toolArgsFromInput(input)
      });
    }
    return this.runTool({ call, toolName });
  }

  async resume(call: ExecutorResumeCall): Promise<ExecutionResult> {
    const decision = decisionOf(call.payload);
    if (decision === "reject" || decision === "skip") {
      return { kind: "failed", error: decision };
    }
    const input = this.toolInput(call);
    const fromPayload =
      call.payload && typeof call.payload === "object"
        ? (call.payload as { toolName?: unknown }).toolName
        : undefined;
    const toolName =
      toolNameFromInput(input) ??
      (typeof fromPayload === "string" ? fromPayload : null);
    if (!toolName) {
      return {
        kind: "failed",
        error: "tool task missing input.toolName"
      };
    }
    return this.runTool({ call, toolName });
  }

  private async runTool(opts: {
    call: ExecutorCall;
    toolName: string;
  }): Promise<ExecutionResult> {
    try {
      const result = await this.executeDirectTool({
        sessionId: opts.call.context.sessionId,
        turnId: opts.call.context.turnId,
        toolName: opts.toolName,
        args: toolArgsFromInput(this.toolInput(opts.call)),
        agentMode: null
      });
      if (result.unknownTool) {
        return { kind: "failed", error: `unknown tool: ${opts.toolName}` };
      }
      if (!result.success) {
        return {
          kind: "failed",
          error: result.error ?? result.output ?? "tool failed"
        };
      }
      return {
        kind: "completed",
        output: {
          kind: "value",
          value: normalizeRawToolResult(result.output)
        }
      };
    } catch (err) {
      return {
        kind: "failed",
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
}
