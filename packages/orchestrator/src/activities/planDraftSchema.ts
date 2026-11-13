import { z } from "zod";
import {
  MAX_PLAN_SECTIONS,
  MAX_TASKS_PER_PLAN_VERSION,
  MAX_TASK_SCHEMA_DESCRIPTION_CHARS,
  MAX_TASK_SCHEMA_ENUM_VALUES,
  TASK_SCHEMA_FORMAT_VERSION
} from "@forge/core";

const taskSchemaType = z.enum([
  "object",
  "array",
  "string",
  "number",
  "integer",
  "boolean",
  "null"
]);

const taskSchemaNode: z.ZodType<unknown> = z.lazy(() =>
  z
    .object({
      type: taskSchemaType,
      properties: z.record(z.string(), taskSchemaNode).optional(),
      required: z.array(z.string()).optional(),
      items: taskSchemaNode.optional(),
      description: z.string().max(MAX_TASK_SCHEMA_DESCRIPTION_CHARS).optional(),
      enum: z
        .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .max(MAX_TASK_SCHEMA_ENUM_VALUES)
        .optional(),
      additionalProperties: z.boolean().optional()
    })
    .strict()
);

const taskSchemaDocument = z
  .object({
    schemaVersion: z.literal(TASK_SCHEMA_FORMAT_VERSION),
    type: taskSchemaType,
    properties: z.record(z.string(), taskSchemaNode).optional(),
    required: z.array(z.string()).optional(),
    items: taskSchemaNode.optional(),
    description: z.string().max(MAX_TASK_SCHEMA_DESCRIPTION_CHARS).optional(),
    enum: z
      .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .max(MAX_TASK_SCHEMA_ENUM_VALUES)
      .optional(),
    additionalProperties: z.boolean().optional()
  })
  .strict()
  .describe("JSON Schema subset with schemaVersion 1");

const inputMappingSchema = z
  .object({
    fromTask: z.string().min(1),
    outputPath: z.string().optional(),
    targetPath: z.string().optional()
  })
  .strict();

const emptyTaskSchemaDefault = {
  schemaVersion: 1 as const,
  type: "object" as const,
  additionalProperties: false,
  properties: {} as Record<string, never>
};

export function coercePlannerTaskDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const t = raw as Record<string, unknown>;
  const descriptionCandidate = [t.description, t.title, t.summary, t.id].find(
    (v) => typeof v === "string" && v.trim().length > 0
  );
  return {
    ...t,
    description:
      typeof descriptionCandidate === "string"
        ? descriptionCandidate
        : t.description,
    dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
    idempotent: typeof t.idempotent === "boolean" ? t.idempotent : false,
    inputSchema: t.inputSchema ?? emptyTaskSchemaDefault,
    outputSchema: t.outputSchema ?? emptyTaskSchemaDefault
  };
}

const taskDraftSchema = z.preprocess(
  coercePlannerTaskDraft,
  z.object({
    id: z.string().min(1).describe("Unique kebab-case task id"),
    description: z.string().min(1).describe("What this task must accomplish"),
    executor: z
      .enum(["agent", "tool", "human"])
      .describe("Who runs the task: coding agent, direct tool, or human"),
    dependencies: z
      .array(z.string())
      .default([])
      .describe("Task ids that must complete first; use [] when none"),
    idempotent: z
      .boolean()
      .default(false)
      .describe("True when safe to retry (read-only, compile, test)"),
    input: z
      .object({
        toolName: z.string().optional(),
        args: z.record(z.string(), z.unknown()).optional()
      })
      .optional()
      .describe("For executor=tool: { toolName, args }"),
    inputSchema: taskSchemaDocument
      .default(emptyTaskSchemaDefault)
      .describe(
        "Mandatory input contract; object schemas should set additionalProperties:false"
      ),
    outputSchema: taskSchemaDocument
      .default(emptyTaskSchemaDefault)
      .describe(
        "Mandatory output contract; agent/tool/human must satisfy this"
      ),
    rationale: z
      .string()
      .optional()
      .describe(
        "Why this task exists and how it advances the approach (not the action itself)"
      ),
    isolation: z
      .enum(["inline", "child"])
      .optional()
      .describe(
        "Agent only: inline (parent turn, default) or child (parallel sub-agent). Prefer child for independent research/read-only fan-out."
      ),
    inputMappings: z
      .array(inputMappingSchema)
      .optional()
      .describe("Optional fromTask outputPath→targetPath mappings")
  })
);

const planSectionSchema = z.object({
  title: z.string().min(1).describe("Section heading (any useful title)"),
  body: z.string().min(1).describe("Section body text")
});

export const planDraftSchema = z.object({
  goal: z.string().min(1).describe("Short statement of the user goal"),
  sections: z
    .array(planSectionSchema)
    .max(MAX_PLAN_SECTIONS)
    .optional()
    .describe(
      "Optional narrative sections; invent titles as needed (e.g. Problem, Approach, Out of scope, Risks, Constraints)"
    ),
  tasks: z
    .array(taskDraftSchema)
    .min(1)
    .max(MAX_TASKS_PER_PLAN_VERSION)
    .describe(`Ordered tasks, at most ${MAX_TASKS_PER_PLAN_VERSION}`)
});

export type PlanDraftSchema = z.infer<typeof planDraftSchema>;
