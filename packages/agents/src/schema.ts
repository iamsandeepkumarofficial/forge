import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { AgentDefinition } from "./types.js";
const modelSchema = z
  .object({
    provider: z.enum(["anthropic", "openai", "openai-compatible"]).optional(),
    name: z.string().optional(),
    baseUrl: z.string().optional()
  })
  .optional();
export const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z
    .enum([
      "planning",
      "design",
      "coding",
      "testing",
      "review",
      "devops",
      "maintenance"
    ])
    .optional(),
  description: z.string().min(1),
  model: modelSchema,
  tools: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  systemPrompt: z.string().min(1),
  webBudgets: z
    .object({
      maxSearches: z.number().int().positive().optional(),
      maxFetches: z.number().int().positive().optional(),
      maxTotal: z.number().int().positive().optional()
    })
    .optional()
});
export function parseAgent(yamlText: string): AgentDefinition {
  return agentSchema.parse(parseYaml(yamlText)) as AgentDefinition;
}
