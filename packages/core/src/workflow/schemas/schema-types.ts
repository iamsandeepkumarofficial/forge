export const TASK_SCHEMA_FORMAT_VERSION = 1;

export const MAX_TASK_SCHEMA_BYTES = 8192;
export const MAX_TASK_SCHEMA_DEPTH = 4;
export const MAX_TASK_SCHEMA_PROPERTIES = 32;
export const MAX_TASK_SCHEMA_ENUM_VALUES = 16;
export const MAX_TASK_SCHEMA_DESCRIPTION_CHARS = 256;
export const MAX_INLINE_TASK_OUTPUT_BYTES = 65_536;

export const TASK_SCHEMA_TYPES = [
  "object",
  "array",
  "string",
  "number",
  "integer",
  "boolean",
  "null"
] as const;
export type TaskSchemaType = (typeof TASK_SCHEMA_TYPES)[number];

export type TaskSchemaNode = {
  type: TaskSchemaType;
  properties?: Record<string, TaskSchemaNode>;
  required?: string[];
  items?: TaskSchemaNode;
  description?: string;
  enum?: Array<string | number | boolean | null>;
  additionalProperties?: boolean;
};

export type TaskSchema = TaskSchemaNode & {
  schemaVersion: typeof TASK_SCHEMA_FORMAT_VERSION;
};

export type InputMapping = {
  fromTask: string;
  outputPath?: string;
  targetPath?: string;
};

export type ArtifactMetadata = {
  bytes: number;
  contentType: string;
};

export type TaskOutput =
  | { kind: "value"; value: unknown }
  | { kind: "artifact"; artifactId: string; metadata: ArtifactMetadata };

export type SchemaValidationError = {
  code:
    | "not_object"
    | "invalid_schema_version"
    | "invalid_type"
    | "unknown_keyword"
    | "budget_bytes"
    | "budget_depth"
    | "budget_properties"
    | "budget_enum"
    | "budget_description"
    | "invalid_additional_properties"
    | "invalid_properties"
    | "invalid_items"
    | "invalid_required"
    | "invalid_enum";
  message: string;
  path?: string;
};

export type ValueValidationError = {
  code:
    | "type_mismatch"
    | "missing_required"
    | "additional_property"
    | "enum_mismatch"
    | "invalid_array_item";
  message: string;
  path?: string;
};

export function emptyObjectSchema(): TaskSchema {
  return {
    schemaVersion: TASK_SCHEMA_FORMAT_VERSION,
    type: "object",
    additionalProperties: false,
    properties: {}
  };
}
