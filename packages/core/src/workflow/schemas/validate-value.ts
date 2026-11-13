import type { TaskSchemaNode, ValueValidationError } from "./schema-types.js";

function typeOfValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value: unknown, type: TaskSchemaNode["type"]): boolean {
  switch (type) {
    case "object":
      return (
        value !== null && typeof value === "object" && !Array.isArray(value)
      );
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return false;
  }
}

export function validateAgainstSchema(opts: {
  schema: TaskSchemaNode;
  value: unknown;
  path?: string;
}): ValueValidationError[] {
  const path = opts.path ?? "";
  const { schema, value } = opts;
  const errors: ValueValidationError[] = [];
  if (!matchesType(value, schema.type)) {
    errors.push({
      code: "type_mismatch",
      message: `Expected ${schema.type}, got ${typeOfValue(value)}`,
      path
    });
    return errors;
  }

  if (schema.enum) {
    const ok = schema.enum.some((e) => Object.is(e, value));
    if (!ok) {
      errors.push({
        code: "enum_mismatch",
        message: "Value is not in enum",
        path
      });
    }
  }

  if (schema.type === "object" && value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const props = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (!(key in obj)) {
        errors.push({
          code: "missing_required",
          message: `Missing required property "${key}"`,
          path: path ? `${path}.${key}` : key
        });
      }
    }
    const allowAdditional = schema.additionalProperties === true;
    for (const key of Object.keys(obj)) {
      if (!(key in props)) {
        if (!allowAdditional) {
          errors.push({
            code: "additional_property",
            message: `Unexpected property "${key}"`,
            path: path ? `${path}.${key}` : key
          });
        }
        continue;
      }
      errors.push(
        ...validateAgainstSchema({
          schema: props[key]!,
          value: obj[key],
          path: path ? `${path}.${key}` : key
        })
      );
    }
  }

  if (schema.type === "array" && Array.isArray(value) && schema.items) {
    value.forEach((item, i) => {
      const childErrors = validateAgainstSchema({
        schema: schema.items!,
        value: item,
        path: path ? `${path}[${i}]` : `[${i}]`
      });
      for (const err of childErrors) {
        errors.push({
          ...err,
          code: err.code === "type_mismatch" ? "invalid_array_item" : err.code
        });
      }
    });
  }

  return errors;
}
