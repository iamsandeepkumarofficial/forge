import { tool, type Tool } from "ai";
import { formatToolDescription } from "@forge/core";
import type { ToolRun } from "../types.js";
import { invokeSkillInputSchema, listSkillsInputSchema } from "../schemas.js";

export function skillTools(run: ToolRun): Record<string, Tool> {
  return {
    list_skills: tool({
      description: formatToolDescription("list_skills"),
      inputSchema: listSkillsInputSchema,
      execute: async () => run("list_skills", {})
    }),
    invoke_skill: tool({
      description: formatToolDescription("invoke_skill"),
      inputSchema: invokeSkillInputSchema,
      execute: async (input) => run("invoke_skill", input)
    })
  };
}
