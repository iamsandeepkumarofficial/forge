import { tool, type Tool } from "ai";
import { formatToolDescription } from "@forge/core";
import type { ToolRun } from "../types.js";
import { webFetchInputSchema, webSearchInputSchema } from "../schemas.js";

export function optionalWebTools(run: ToolRun): Record<string, Tool> {
  return {
    web_search: tool({
      description: formatToolDescription("web_search"),
      inputSchema: webSearchInputSchema,
      execute: async (input) => run("web_search", input)
    }),
    web_fetch: tool({
      description: formatToolDescription("web_fetch"),
      inputSchema: webFetchInputSchema,
      execute: async (input) => run("web_fetch", input)
    })
  };
}
