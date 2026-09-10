import { tool, type Tool } from "ai";
import { formatToolDescription } from "@forge/core";
import type { ToolRun } from "../types.js";
import {
  dockerImageLookupInputSchema,
  getWorkspaceHealthInputSchema,
  installProjectInfraInputSchema,
  setupProjectInfraInputSchema,
  upsertWorkspaceParameterInputSchema
} from "../schemas.js";

export function setupTools(
  run: ToolRun,
  options?: { includeDockerImageLookup?: boolean }
): Record<string, Tool> {
  const tools: Record<string, Tool> = {
    get_workspace_health: tool({
      description: formatToolDescription("get_workspace_health"),
      inputSchema: getWorkspaceHealthInputSchema,
      execute: async (input) => run("get_workspace_health", input)
    }),
    upsert_workspace_parameter: tool({
      description: formatToolDescription("upsert_workspace_parameter"),
      inputSchema: upsertWorkspaceParameterInputSchema,
      execute: async (input) => run("upsert_workspace_parameter", input)
    }),
    setup_project_infra: tool({
      description: formatToolDescription("setup_project_infra"),
      inputSchema: setupProjectInfraInputSchema,
      execute: async (input) => run("setup_project_infra", input)
    }),
    install_project_infra: tool({
      description: formatToolDescription("install_project_infra"),
      inputSchema: installProjectInfraInputSchema,
      execute: async (input) => run("install_project_infra", input)
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
