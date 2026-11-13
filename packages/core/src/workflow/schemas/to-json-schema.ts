import {
  TASK_SCHEMA_TYPES,
  type TaskSchema,
  type TaskSchemaNode
} from "./schema-types.js";

export function taskSchemaToJsonSchema(
  schema: TaskSchema | TaskSchemaNode | Record<string, unknown>
): Record<string, unknown> {
  return stripSchemaVersion(schema) as Record<string, unknown>;
}

function stripSchemaVersion(node: unknown): unknown {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return node;
  }
  const src = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (key === "schemaVersion") {
      continue;
    }
    if (key === "properties" && value && typeof value === "object") {
      const props: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(value as Record<string, unknown>)) {
        props[pk] = stripSchemaVersion(pv);
      }
      out.properties = props;
      continue;
    }
    if (key === "items") {
      out.items = stripSchemaVersion(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function isSchemaNode(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return (
    typeof type === "string" &&
    (TASK_SCHEMA_TYPES as readonly string[]).includes(type)
  );
}

export function looksLikeTaskSchemaDocument(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const bag = value as Record<string, unknown>;
  if (bag.schemaVersion !== undefined && bag.type === "object") {
    return true;
  }
  if (
    bag.type !== "object" ||
    !bag.properties ||
    typeof bag.properties !== "object" ||
    Array.isArray(bag.properties)
  ) {
    return false;
  }
  const fields = Object.values(bag.properties as Record<string, unknown>);
  return fields.length > 0 && fields.every(isSchemaNode);
}
