import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { PipelineDefinition } from "./types.js";
const columnSchema = z.string().min(1);
const stageSchema = z.object({
  id: z.string().min(1),
  agent: z.string().min(1),
  column: columnSchema,
  action: z.enum(["generate", "implement"]),
  commentTitle: z.string().min(1),
  gate: z.enum(["human", "auto"])
});
export const pipelineSchema = z.object({
  name: z.string().min(1),
  version: z.number().int().positive(),
  stages: z.array(stageSchema).min(1),
  finalColumn: columnSchema
});
export function parsePipeline(yamlText: string): PipelineDefinition {
  return pipelineSchema.parse(parseYaml(yamlText)) as PipelineDefinition;
}
