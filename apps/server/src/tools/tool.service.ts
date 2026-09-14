import {
  isToolAllowedForMode,
  parseAgentMode,
  toolDeniedMessage,
  type AgentMode
} from "@forge/core";
import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { ChatFeatureService } from "../projects/chatFeatureService.js";
import type { WebBudgetLimits } from "./web/budgets.js";
import { PreviewToolService } from "./preview.tool.js";
import type { ToolExecuteOutcome } from "./types.js";
import {
  executeWebToolCall,
  executeCreateSubtask,
  executePreviewToolCall,
  executeSandboxToolCall,
  SANDBOX_TOOL_NAMES
} from "./toolExecutors.js";
import { executeListSkills } from "./listSkills.tool.js";
import { executeInvokeSkill } from "./invokeSkill.tool.js";
import { executeUpsertWorkspaceParameter } from "./upsertWorkspaceParameter.tool.js";
import { executeGetWorkspaceHealth } from "./getWorkspaceHealth.tool.js";
import { executeDockerImageLookup } from "./dockerImageLookup.tool.js";
import { executeSetupProjectInfra } from "./setupProjectInfra.tool.js";
import { executeInstallProjectInfra } from "./installProjectInfra.tool.js";
import { parseTouchedFilesMetadata } from "./fileBatch.js";
import { recordTouchedFiles } from "../projects/workspaceCheckpoint.js";

const N_200 = 200;
const N_400 = 400;

export interface ToolExecuteParams {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  turnId?: string | null;
  agentMode?: AgentMode | string | null;
  webBudgets?: Partial<WebBudgetLimits> | null;
}

export class ToolService {
  private previewTools: PreviewToolService;
  private chatFeatureRepo: ChatFeatureRepository;
  private chatFeatureService: ChatFeatureService;
  constructor(deps: {
    previewTools: PreviewToolService;
    chatFeatureRepo: ChatFeatureRepository;
    chatFeatureService: ChatFeatureService;
  }) {
    this.previewTools = deps.previewTools;
    this.chatFeatureRepo = deps.chatFeatureRepo;
    this.chatFeatureService = deps.chatFeatureService;
  }
  async execute(params: ToolExecuteParams): Promise<ToolExecuteOutcome> {
    const denied = denyIfModeBlocks(params);
    if (denied) return denied;
    const routed = await routeNamedTool({
      params,
      previewTools: this.previewTools,
      chatFeatureRepo: this.chatFeatureRepo,
      chatFeatureService: this.chatFeatureService
    });
    let outcome: ToolExecuteOutcome;
    if (routed) {
      outcome = routed;
    } else if (SANDBOX_TOOL_NAMES.has(params.toolName)) {
      outcome = await executeSandboxToolCall({
        sessionId: params.sessionId,
        toolName: params.toolName,
        args: params.args
      });
    } else {
      outcome = {
        kind: "error",
        status: N_400,
        body: { error: `unknown tool: ${params.toolName}` }
      };
    }
    await maybeRecordTouchedFiles(params, outcome);
    return outcome;
  }
}

async function maybeRecordTouchedFiles(
  params: ToolExecuteParams,
  outcome: ToolExecuteOutcome
): Promise<void> {
  if (outcome.kind !== "result") return;
  const turnId = params.turnId?.trim();
  if (!turnId) return;
  const files = parseTouchedFilesMetadata(outcome.body.metadata?.files);
  if (files.length === 0) return;
  try {
    await recordTouchedFiles({
      sessionId: params.sessionId,
      turnId,
      files
    });
  } catch (err) {
    console.warn(
      `[checkpoint] failed to record touched files for ${turnId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

function denyIfModeBlocks(
  params: ToolExecuteParams
): ToolExecuteOutcome | null {
  const parsedMode = parseAgentMode(params.agentMode);
  if (
    parsedMode &&
    !isToolAllowedForMode({ agentMode: parsedMode, toolName: params.toolName })
  ) {
    return {
      kind: "result",
      status: N_200,
      body: {
        success: false,
        output: toolDeniedMessage({
          agentMode: parsedMode,
          toolName: params.toolName
        })
      }
    };
  }
  return null;
}

async function routeNamedTool(options: {
  params: ToolExecuteParams;
  previewTools: PreviewToolService;
  chatFeatureRepo: ChatFeatureRepository;
  chatFeatureService: ChatFeatureService;
}): Promise<ToolExecuteOutcome | null> {
  const { params, previewTools, chatFeatureRepo, chatFeatureService } = options;
  const { sessionId, toolName, args, turnId, webBudgets } = params;
  if (toolName === "web_search" || toolName === "web_fetch") {
    return executeWebToolCall({
      sessionId,
      toolName,
      args,
      turnId,
      webBudgets
    });
  }
  if (toolName === "create_subtask") {
    return executeCreateSubtask({
      sessionId,
      args,
      chatFeatureRepo,
      chatFeatureService
    });
  }
  if (
    toolName === "preview_start" ||
    toolName === "preview_stop" ||
    toolName === "preview_status" ||
    toolName === "preview_logs" ||
    toolName === "upsert_launch_app"
  ) {
    return executePreviewToolCall({
      sessionId,
      toolName,
      args,
      previewTools
    });
  }
  if (toolName === "list_skills") {
    const body = await executeListSkills(sessionId);
    return { kind: "result", status: N_200, body };
  }
  if (toolName === "invoke_skill") {
    const skillId = typeof args.skillId === "string" ? args.skillId : "";
    const body = await executeInvokeSkill({ sessionId, skillId });
    return { kind: "result", status: N_200, body };
  }
  if (toolName === "get_workspace_health") {
    const body = await executeGetWorkspaceHealth({ sessionId, args });
    return { kind: "result", status: N_200, body };
  }
  if (toolName === "upsert_workspace_parameter") {
    const body = await executeUpsertWorkspaceParameter({ sessionId, args });
    return { kind: "result", status: N_200, body };
  }
  if (toolName === "docker_image_lookup") {
    const body = await executeDockerImageLookup({ sessionId, args });
    return { kind: "result", status: N_200, body };
  }
  if (toolName === "setup_project_infra") {
    const body = await executeSetupProjectInfra({ sessionId, args });
    return { kind: "result", status: N_200, body };
  }
  if (toolName === "install_project_infra") {
    const body = await executeInstallProjectInfra({ sessionId, args });
    return { kind: "result", status: N_200, body };
  }
  return null;
}
