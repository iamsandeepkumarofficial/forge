import type { TaskSchema, ValueValidationError } from "./schema-types.js";
import { validateAgainstSchema } from "./validate-value.js";

export type ValidateTaskInputResult =
  { ok: true } | { ok: false; errors: ValueValidationError[] };

export function validateTaskInput(
  inputSchema: TaskSchema,
  input: unknown
): ValidateTaskInputResult {
  const errors = validateAgainstSchema({ schema: inputSchema, value: input });
  return errors.length ? { ok: false, errors } : { ok: true };
}
