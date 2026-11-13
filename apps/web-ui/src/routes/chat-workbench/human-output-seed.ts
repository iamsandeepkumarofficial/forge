import type { PlanCardSchemaNode } from "./plan-card.js";

export function defaultValueFor(node: PlanCardSchemaNode): unknown {
  if (node.enum && node.enum.length > 0) {
    return node.enum[0];
  }
  switch (node.type) {
    case "boolean":
      return undefined;
    case "number":
    case "integer":
      return 0;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
}

export function schemaJsonSeed(schema: PlanCardSchemaNode | undefined): string {
  if (!schema) return "{}";
  return JSON.stringify(skeletonFor(schema), null, 2);
}

function skeletonFor(node: PlanCardSchemaNode): unknown {
  if (node.enum && node.enum.length > 0) {
    return node.enum[0];
  }
  switch (node.type) {
    case "boolean":
      return false;
    case "number":
    case "integer":
      return 0;
    case "array":
      return node.items ? [skeletonFor(node.items)] : [];
    case "object": {
      const obj: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node.properties ?? {})) {
        obj[key] = skeletonFor(child);
      }
      return obj;
    }
    default:
      return "";
  }
}

export function isFlatSchema(opts: {
  schema: PlanCardSchemaNode | undefined;
  entries: Array<[string, PlanCardSchemaNode]>;
}): boolean {
  return (
    opts.schema?.type === "object" &&
    opts.entries.every(([, node]) => {
      const t = node.type;
      return (
        t === "string" ||
        t === "number" ||
        t === "integer" ||
        t === "boolean" ||
        Boolean(node.enum)
      );
    })
  );
}
