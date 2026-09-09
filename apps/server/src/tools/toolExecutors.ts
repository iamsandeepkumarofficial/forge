import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import {
  ChatFeatureService,
  ChatFeatureValidationError
} from "../projects/chatFeatureService.js";
import { executeWebTool } from "./web/executeWebTool.js";
import type { WebBudgetLimits } from "./web/budgets.js";
import { PreviewToolService } from "./preview.tool.js";
import { SANDBOX_TOOL_NAMES, executeSandboxTool } from "./sandbox.tool.js";
import type { ToolExecuteOutcome } from "./types.js";

const N_200 = 200;

export async function executeWebToolCall(options: {
  sessionId: string;
  toolName: "web_search" | "web_fetch";
  args: Record<string, unknown>;
  turnId?: string | null;
  webBudgets?: Partial<WebBudgetLimits> | null;
}): Promise<ToolExecuteOutcome> {
  const { sessionId, toolName, args, turnId, webBudgets } = options;
  if (toolName === "web_search") {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!query) {
      return {
        kind: "result",
        status: N_200,
        body: {
          success: false,
          output: "web_search failed: query is required",
          metadata: { code: "provider" }
        }
      };
    }
  }
  try {
    const body = await executeWebTool({
      sessionId: sessionId.trim(),
      toolName,
      args,
      turnId: turnId ?? null,
      budgets: webBudgets ?? null
    });
    return { kind: "result", status: N_200, body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      kind: "result",
      status: N_200,
      body: {
        success: false,
        output: `${toolName} failed: ${message}`,
        metadata: { code: "provider" }
      }
    };
  }
}

export async function executeCreateSubtask(options: {
  sessionId: string;
  args: Record<string, unknown>;
  chatFeatureRepo: ChatFeatureRepository;
  chatFeatureService: ChatFeatureService;
}): Promise<ToolExecuteOutcome> {
  const { sessionId, args, chatFeatureRepo, chatFeatureService } = options;
  try {
    const owner = await chatFeatureRepo.getBySessionId(sessionId);
    if (!owner) {
      return {
        kind: "result",
        status: N_200,
        body: {
          success: false,
          output: `No chat/feature found for session: ${sessionId}`,
          metadata: {}
        }
      };
    }
    const title = typeof args.title === "string" ? args.title : "";
    const type = typeof args.type === "string" ? args.type : undefined;
    const created = await chatFeatureService.create({
      projectId: owner.projectId,
      userId: owner.userId,
      title,
      type,
      parentId: owner.id
    });
    return {
      kind: "result",
      status: N_200,
      body: {
        success: true,
        output: `Created subtask "${created.title}" (${created.id}) under this chat.`,
        metadata: {
          chatId: created.id,
          parentId: owner.id,
          status: created.status
        }
      }
    };
  } catch (err) {
    if (err instanceof ChatFeatureValidationError) {
      return {
        kind: "result",
        status: N_200,
        body: { success: false, output: err.message, metadata: {} }
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      kind: "result",
      status: N_200,
      body: { success: false, output: message, metadata: {} }
    };
  }
}

export async function executePreviewToolCall(options: {
  sessionId: string;
  toolName:
    | "preview_start"
    | "preview_stop"
    | "preview_status"
    | "preview_logs"
    | "upsert_launch_app";
  args: Record<string, unknown>;
  previewTools: PreviewToolService;
}): Promise<ToolExecuteOutcome> {
  const { sessionId, toolName, args, previewTools } = options;
  try {
    if (toolName === "preview_start") {
      const body = await previewTools.start(sessionId, args);
      return { kind: "result", status: N_200, body };
    }
    if (toolName === "preview_stop") {
      const body = await previewTools.stop(sessionId, args);
      return { kind: "result", status: N_200, body };
    }
    if (toolName === "preview_status") {
      const body = await previewTools.status(sessionId, args);
      return { kind: "result", status: N_200, body };
    }
    if (toolName === "upsert_launch_app") {
      const body = await previewTools.upsert(sessionId, args);
      return { kind: "result", status: N_200, body };
    }
    const body = await previewTools.logs(sessionId, args);
    return { kind: "result", status: N_200, body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      kind: "result",
      status: N_200,
      body: { success: false, output: message, metadata: {} }
    };
  }
}

export async function executeSandboxToolCall(options: {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
}): Promise<ToolExecuteOutcome> {
  try {
    const result = await executeSandboxTool(options);
    return {
      kind: "result",
      status: N_200,
      body: {
        success: result.success,
        output: result.output ?? "",
        metadata: result.metadata ?? {}
      }
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      kind: "result",
      status: N_200,
      body: { success: false, output: message, metadata: {} }
    };
  }
}

export { SANDBOX_TOOL_NAMES };
