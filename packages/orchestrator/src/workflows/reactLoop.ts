import {
  looksLikeTaskSchemaDocument,
  taskSchemaToJsonSchema,
  validateTaskOutput,
  type TaskSchema
} from "@forge/core";

export function trivialStructuredOutputGaps(
  schema: Record<string, unknown>,
  value: unknown
): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["output is not an object"];
  }
  const required = Array.isArray(schema.required)
    ? schema.required.filter((k): k is string => typeof k === "string")
    : [];
  const properties =
    schema.properties && typeof schema.properties === "object"
      ? (schema.properties as Record<string, Record<string, unknown>>)
      : {};
  const gaps: string[] = [];
  const obj = value as Record<string, unknown>;
  for (const key of required) {
    const fieldSchema = properties[key];
    const field = obj[key];
    const type = fieldSchema?.type;
    if (type === "string" && typeof field === "string" && !field.trim()) {
      gaps.push(`${key} is an empty string`);
    }
    if (type === "array" && Array.isArray(field) && field.length === 0) {
      gaps.push(`${key} is an empty array`);
    }
  }
  return gaps;
}

export function acceptStructuredOutput(
  schema: Record<string, unknown> | undefined,
  candidate: unknown
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!schema) {
    return { ok: true, value: candidate };
  }
  if (candidate === undefined) {
    return { ok: false, error: "no structured output produced" };
  }
  if (looksLikeTaskSchemaDocument(candidate)) {
    return {
      ok: false,
      error:
        "emitted a schema document (type/properties/...) instead of instance data"
    };
  }
  const validated = validateTaskOutput(schema as TaskSchema, candidate);
  if (!validated.ok) {
    return {
      ok: false,
      error: validated.errors.map((e) => e.message).join("; ")
    };
  }
  const gaps = trivialStructuredOutputGaps(schema, validated.value);
  if (gaps.length > 0) {
    return {
      ok: false,
      error: `trivial/empty required fields: ${gaps.join("; ")}`
    };
  }
  return { ok: true, value: validated.value };
}

export function schemaRepairText(
  error: string,
  schema: Record<string, unknown>
): string {
  return [
    `Previous result failed outputSchema validation: ${error}`,
    "Emit ONLY the JSON instance data matching this schema (values, not the schema document itself):",
    JSON.stringify(taskSchemaToJsonSchema(schema as TaskSchema))
  ].join("\n");
}

export { assistantPartsForStep, runToolRoundLoop } from "./reactLoopRun.js";
