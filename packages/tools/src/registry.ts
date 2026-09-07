import type { Tool } from "ai";
import type { AgentMode } from "@forge/core";
import { workspaceFileTools } from "./definitions/files.js";
import { shellTools } from "./definitions/shell.js";
import { previewTools } from "./definitions/preview.js";
import { skillTools } from "./definitions/skills.js";
import { setupTools } from "./definitions/setup.js";
import { optionalWebTools } from "./definitions/web.js";
import { askUserTool, switchModeTool } from "./hitl.js";
import type { RegistryOptions, ToolRun } from "./types.js";

export function createForwardableToolRegistry(
  run: ToolRun,
  options: RegistryOptions = {}
): Record<string, Tool> {
  const includeDocker =
    options.includeDockerImageLookup !== undefined
      ? options.includeDockerImageLookup
      : true;
  const includeWeb = options.includeWebTools === true;
  return {
    ...workspaceFileTools(run),
    ...shellTools(run),
    ...previewTools(run),
    ...skillTools(run),
    ...setupTools(run, { includeDockerImageLookup: includeDocker }),
    ...(includeWeb ? optionalWebTools(run) : {})
  };
}

export function createChatToolRegistry(options: {
  run: ToolRun;
  currentMode: AgentMode;
  includeWebTools?: boolean;
  includeDockerImageLookup?: boolean;
}): Record<string, Tool> {
  return {
    ...createForwardableToolRegistry(options.run, {
      includeWebTools: options.includeWebTools,
      includeDockerImageLookup: options.includeDockerImageLookup
    }),
    ...switchModeTool(options.currentMode),
    ...askUserTool()
  };
}
