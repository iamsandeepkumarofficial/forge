import { tool, type Tool } from "ai";
import { z } from "zod";
import { formatToolDescription } from "@forge/core";

type ToolRun = (
  name: string,
  args: Record<string, unknown>
) => Promise<{
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}>;

export function hostModeHidesDockerImageLookup(): boolean {
  const raw = process.env.SANDBOX_RUNTIME?.trim().toLowerCase();
  if (raw === "host") return true;
  if (raw === "docker" || raw === "kubernetes" || raw === "k8s") return false;
  return process.env.FORGE_DESKTOP?.trim() === "1";
}

export function setupTools(run: ToolRun): Record<string, Tool> {
  const tools: Record<string, Tool> = {
    upsert_workspace_parameter: tool({
      description: formatToolDescription("upsert_workspace_parameter"),
      inputSchema: z.object({
        key: z.string(),
        value: z.string(),
        secret: z.boolean().optional()
      }),
      execute: async (input) =>
        run("upsert_workspace_parameter", input as Record<string, unknown>)
    }),
    provision_app_engine: tool({
      description: formatToolDescription("provision_app_engine"),
      inputSchema: z.object({
        engineId: z.enum(["postgres", "mongo"]),
        userApproved: z
          .boolean()
          .describe("Must be true only after the user explicitly approved.")
      }),
      execute: async (input) =>
        run("provision_app_engine", input as Record<string, unknown>)
    })
  };
  if (!hostModeHidesDockerImageLookup()) {
    tools.docker_image_lookup = tool({
      description: formatToolDescription("docker_image_lookup"),
      inputSchema: z.object({
        query: z.string().optional(),
        engineId: z.enum(["postgres", "mongo"]).optional()
      }),
      execute: async (input) =>
        run("docker_image_lookup", input as Record<string, unknown>)
    });
  }
  return tools;
}
