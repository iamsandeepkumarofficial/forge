import { tool, type Tool } from "ai";
import { formatToolDescription } from "@forge/core";
import type { ToolRun } from "../types.js";
import {
  dockerImageLookupInputSchema,
  provisionAppEngineInputSchema,
  upsertWorkspaceParameterInputSchema
} from "../schemas.js";

export function setupTools(
  run: ToolRun,
  options?: { includeDockerImageLookup?: boolean }
): Record<string, Tool> {
  const tools: Record<string, Tool> = {
    upsert_workspace_parameter: tool({
      description: formatToolDescription("upsert_workspace_parameter"),
      inputSchema: upsertWorkspaceParameterInputSchema,
      execute: async (input) => run("upsert_workspace_parameter", input)
    }),
    provision_app_engine: tool({
      description: formatToolDescription("provision_app_engine"),
      inputSchema: provisionAppEngineInputSchema,
      execute: async (input) => run("provision_app_engine", input)
    })
  };
  if (options?.includeDockerImageLookup !== false) {
    tools.docker_image_lookup = tool({
      description: formatToolDescription("docker_image_lookup"),
      inputSchema: dockerImageLookupInputSchema,
      execute: async (input) => run("docker_image_lookup", input)
    });
  }
  return tools;
}
