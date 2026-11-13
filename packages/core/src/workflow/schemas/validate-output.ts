import type {
  TaskOutput,
  TaskSchema,
  ValueValidationError
} from "./schema-types.js";
import { validateAgainstSchema } from "./validate-value.js";

export type ValidateTaskOutputResult =
  { ok: true; value: unknown } | { ok: false; errors: ValueValidationError[] };

export function validateTaskOutput(
  outputSchema: TaskSchema,
  value: unknown
): ValidateTaskOutputResult {
  const errors = validateAgainstSchema({ schema: outputSchema, value });
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function unwrapTaskOutputValue(output: TaskOutput | unknown): unknown {
  if (
    output &&
    typeof output === "object" &&
    (output as TaskOutput).kind === "value"
  ) {
    return (output as Extract<TaskOutput, { kind: "value" }>).value;
  }
  return output;
}

export function isArtifactOutput(
  output: unknown
): output is Extract<TaskOutput, { kind: "artifact" }> {
  return (
    !!output &&
    typeof output === "object" &&
    (output as TaskOutput).kind === "artifact" &&
    typeof (output as { artifactId?: unknown }).artifactId === "string"
  );
}

export function isValueOutput(
  output: unknown
): output is Extract<TaskOutput, { kind: "value" }> {
  return (
    !!output &&
    typeof output === "object" &&
    (output as TaskOutput).kind === "value"
  );
}
