import {
  MAX_TASK_SCHEMA_BYTES,
  MAX_TASK_SCHEMA_DEPTH,
  MAX_TASK_SCHEMA_DESCRIPTION_CHARS,
  MAX_TASK_SCHEMA_ENUM_VALUES,
  MAX_TASK_SCHEMA_PROPERTIES,
  TASK_SCHEMA_FORMAT_VERSION,
  TASK_SCHEMA_TYPES,
  type SchemaValidationError,
  type TaskSchema,
  type TaskSchemaNode,
  type TaskSchemaType
} from "./schema-types.js";

const ROOT_ALLOWED = new Set([
  "schemaVersion",
  "type",
  "properties",
  "required",
  "items",
  "description",
  "enum",
  "additionalProperties"
]);

const NODE_ALLOWED = new Set([
  "type",
  "properties",
  "required",
  "items",
  "description",
  "enum",
  "additionalProperties"
]);

function utf8Bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function isSchemaType(value: unknown): value is TaskSchemaType {
  return (
    typeof value === "string" &&
    (TASK_SCHEMA_TYPES as readonly string[]).includes(value)
  );
}

type NodeWalk = {
  raw: unknown;
  path: string;
  depth: number;
  propertyCount: { n: number };
  errors: SchemaValidationError[];
  isRoot: boolean;
};

function pushUnknownKeys(opts: {
  raw: Record<string, unknown>;
  allowed: Set<string>;
  path: string;
  errors: SchemaValidationError[];
}): void {
  for (const key of Object.keys(opts.raw)) {
    if (!opts.allowed.has(key)) {
      opts.errors.push({
        code: "unknown_keyword",
        message: `Unknown schema keyword "${key}"`,
        path: opts.path
      });
    }
  }
}

function noteDescription(opts: {
  obj: Record<string, unknown>;
  path: string;
  errors: SchemaValidationError[];
}): void {
  if (opts.obj.description === undefined) return;
  if (typeof opts.obj.description !== "string") {
    opts.errors.push({
      code: "budget_description",
      message: "description must be a string",
      path: opts.path
    });
    return;
  }
  if (opts.obj.description.length > MAX_TASK_SCHEMA_DESCRIPTION_CHARS) {
    opts.errors.push({
      code: "budget_description",
      message: `description exceeds ${MAX_TASK_SCHEMA_DESCRIPTION_CHARS} chars`,
      path: opts.path
    });
  }
}

function noteEnum(opts: {
  obj: Record<string, unknown>;
  path: string;
  errors: SchemaValidationError[];
}): void {
  if (opts.obj.enum === undefined) return;
  if (!Array.isArray(opts.obj.enum)) {
    opts.errors.push({
      code: "invalid_enum",
      message: "enum must be an array",
      path: opts.path
    });
    return;
  }
  if (opts.obj.enum.length > MAX_TASK_SCHEMA_ENUM_VALUES) {
    opts.errors.push({
      code: "budget_enum",
      message: `enum exceeds ${MAX_TASK_SCHEMA_ENUM_VALUES} values`,
      path: opts.path
    });
    return;
  }
  for (const v of opts.obj.enum) {
    const t = typeof v;
    if (v !== null && t !== "string" && t !== "number" && t !== "boolean") {
      opts.errors.push({
        code: "invalid_enum",
        message: "enum values must be string|number|boolean|null",
        path: opts.path
      });
      break;
    }
  }
}

function readProperties(
  obj: Record<string, unknown>,
  walk: NodeWalk
): Record<string, TaskSchemaNode> | undefined {
  if (obj.properties === undefined) return undefined;
  if (
    !obj.properties ||
    typeof obj.properties !== "object" ||
    Array.isArray(obj.properties)
  ) {
    walk.errors.push({
      code: "invalid_properties",
      message: "properties must be an object",
      path: walk.path
    });
    return undefined;
  }
  const properties: Record<string, TaskSchemaNode> = {};
  for (const [key, child] of Object.entries(
    obj.properties as Record<string, unknown>
  )) {
    walk.propertyCount.n += 1;
    if (walk.propertyCount.n > MAX_TASK_SCHEMA_PROPERTIES) {
      walk.errors.push({
        code: "budget_properties",
        message: `Schema exceeds ${MAX_TASK_SCHEMA_PROPERTIES} properties`,
        path: walk.path ? `${walk.path}.properties` : "properties"
      });
    }
    const parsed = validateNode({
      raw: child,
      path: walk.path ? `${walk.path}.properties.${key}` : `properties.${key}`,
      depth: walk.depth + 1,
      propertyCount: walk.propertyCount,
      errors: walk.errors,
      isRoot: false
    });
    if (parsed) properties[key] = parsed;
  }
  return properties;
}

function readItems(
  obj: Record<string, unknown>,
  walk: NodeWalk
): TaskSchemaNode | undefined {
  if (obj.items === undefined) return undefined;
  return (
    validateNode({
      raw: obj.items,
      path: walk.path ? `${walk.path}.items` : "items",
      depth: walk.depth + 1,
      propertyCount: walk.propertyCount,
      errors: walk.errors,
      isRoot: false
    }) ?? undefined
  );
}

function readRequired(opts: {
  obj: Record<string, unknown>;
  path: string;
  errors: SchemaValidationError[];
}): string[] | undefined {
  if (opts.obj.required === undefined) return undefined;
  if (
    !Array.isArray(opts.obj.required) ||
    !opts.obj.required.every((r) => typeof r === "string")
  ) {
    opts.errors.push({
      code: "invalid_required",
      message: "required must be an array of strings",
      path: opts.path
    });
    return undefined;
  }
  const required = opts.obj.required as string[];
  if (
    opts.obj.type === "object" &&
    opts.obj.properties &&
    typeof opts.obj.properties === "object" &&
    !Array.isArray(opts.obj.properties)
  ) {
    for (const key of required) {
      if (!(key in (opts.obj.properties as Record<string, unknown>))) {
        opts.errors.push({
          code: "invalid_required",
          message: `required property "${key}" is not in properties`,
          path: opts.path
        });
      }
    }
  }
  return required;
}

function validateNode(walk: NodeWalk): TaskSchemaNode | null {
  if (!walk.raw || typeof walk.raw !== "object" || Array.isArray(walk.raw)) {
    walk.errors.push({
      code: "not_object",
      message: "Schema must be an object",
      path: walk.path
    });
    return null;
  }
  const { path, depth, errors } = walk;
  const obj = walk.raw as Record<string, unknown>;
  pushUnknownKeys({
    raw: obj,
    allowed: walk.isRoot ? ROOT_ALLOWED : NODE_ALLOWED,
    path,
    errors
  });

  if (depth > MAX_TASK_SCHEMA_DEPTH) {
    errors.push({
      code: "budget_depth",
      message: `Schema depth exceeds ${MAX_TASK_SCHEMA_DEPTH}`,
      path
    });
  }

  if (!isSchemaType(obj.type)) {
    errors.push({
      code: "invalid_type",
      message: "Schema type must be a supported JSON Schema type",
      path
    });
    return null;
  }

  noteDescription({ obj, path, errors });
  noteEnum({ obj, path, errors });
  if (
    obj.additionalProperties !== undefined &&
    typeof obj.additionalProperties !== "boolean"
  ) {
    errors.push({
      code: "invalid_additional_properties",
      message: "additionalProperties must be a boolean",
      path
    });
  }

  const properties = readProperties(obj, walk);
  const items = readItems(obj, walk);
  if (obj.type === "array" && obj.items === undefined) {
    errors.push({
      code: "invalid_items",
      message: "array schema requires items",
      path
    });
  }
  const required = readRequired({ obj, path, errors });

  const node: TaskSchemaNode = {
    type: obj.type,
    ...(properties ? { properties } : {}),
    ...(required ? { required } : {}),
    ...(items ? { items } : {}),
    ...(typeof obj.description === "string"
      ? { description: obj.description }
      : {}),
    ...(Array.isArray(obj.enum)
      ? { enum: obj.enum as TaskSchemaNode["enum"] }
      : {}),
    additionalProperties:
      typeof obj.additionalProperties === "boolean"
        ? obj.additionalProperties
        : obj.type === "object"
          ? false
          : undefined
  };
  if (node.additionalProperties === undefined) {
    delete node.additionalProperties;
  }
  return node;
}

export type ValidateTaskSchemaResult =
  | { ok: true; schema: TaskSchema }
  | { ok: false; errors: SchemaValidationError[] };

export function validateTaskSchema(raw: unknown): ValidateTaskSchemaResult {
  const errors: SchemaValidationError[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ code: "not_object", message: "Schema must be an object" }]
    };
  }
  try {
    if (utf8Bytes(raw) > MAX_TASK_SCHEMA_BYTES) {
      errors.push({
        code: "budget_bytes",
        message: `Schema exceeds ${MAX_TASK_SCHEMA_BYTES} bytes`
      });
    }
  } catch {
    errors.push({
      code: "budget_bytes",
      message: "Schema is not JSON-serializable"
    });
  }

  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== TASK_SCHEMA_FORMAT_VERSION) {
    errors.push({
      code: "invalid_schema_version",
      message: `schemaVersion must be ${TASK_SCHEMA_FORMAT_VERSION}`
    });
  }

  const propertyCount = { n: 0 };
  const node = validateNode({
    raw: obj,
    path: "",
    depth: 1,
    propertyCount,
    errors,
    isRoot: true
  });
  if (errors.length || !node) {
    return { ok: false, errors };
  }
  const schema: TaskSchema = {
    ...node,
    schemaVersion: TASK_SCHEMA_FORMAT_VERSION,
    ...(node.type === "object" && node.additionalProperties === undefined
      ? { additionalProperties: false }
      : {})
  };
  return { ok: true, schema };
}
