import { tool, type Tool } from "ai";
import { formatToolDescription } from "@forge/core";
import type { ToolRun } from "../types.js";
import { runTerminalInputSchema } from "../schemas.js";

export function shellTools(run: ToolRun): Record<string, Tool> {
  return {
    run_terminal: tool({
      description: formatToolDescription("run_terminal"),
      inputSchema: runTerminalInputSchema,
      execute: async (input) => run("run_terminal", input)
    })
  };
}
