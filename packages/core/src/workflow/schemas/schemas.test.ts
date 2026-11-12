import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyObjectSchema,
  resolveTaskInput,
  validateTaskInput,
  validateTaskOutput,
  validateTaskSchema,
  TASK_SCHEMA_FORMAT_VERSION,
  MAX_TASK_SCHEMA_PROPERTIES
} from "./index.js";

describe("validateTaskSchema", () => {
  it("requires schemaVersion 1", () => {
    const r = validateTaskSchema({ type: "object" });
    assert.equal(r.ok, false);
  });

  it("rejects unknown version", () => {
    const r = validateTaskSchema({ schemaVersion: 2, type: "object" });
    assert.equal(r.ok, false);
  });

  it("normalizes omitted additionalProperties to false", () => {
    const r = validateTaskSchema({
      schemaVersion: TASK_SCHEMA_FORMAT_VERSION,
      type: "object",
      properties: { a: { type: "string" } },
      required: ["a"]
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.schema.additionalProperties, false);
  });

  it("rejects invented keywords", () => {
    const r = validateTaskSchema({
      schemaVersion: 1,
      type: "object",
      inventedKeyword: true
    });
    assert.equal(r.ok, false);
  });

  it("rejects arrays without items and required keys missing from properties", () => {
    const arraySchema = validateTaskSchema({
      schemaVersion: 1,
      type: "array"
    });
    assert.equal(arraySchema.ok, false);
    const required = validateTaskSchema({
      schemaVersion: 1,
      type: "object",
      properties: { a: { type: "string" } },
      required: ["missing"]
    });
    assert.equal(required.ok, false);
  });

  it("enforces property budget", () => {
    const properties: Record<string, { type: "string" }> = {};
    for (let i = 0; i < MAX_TASK_SCHEMA_PROPERTIES + 1; i++) {
      properties[`p${i}`] = { type: "string" };
    }
    const r = validateTaskSchema({
      schemaVersion: 1,
      type: "object",
      properties
    });
    assert.equal(r.ok, false);
  });
});

describe("validateTaskInput / output", () => {
  const schema = {
    schemaVersion: 1 as const,
    type: "object" as const,
    additionalProperties: false,
    properties: {
      approved: { type: "boolean" as const }
    },
    required: ["approved"]
  };

  it("accepts valid object", () => {
    assert.equal(validateTaskInput(schema, { approved: true }).ok, true);
    assert.equal(validateTaskOutput(schema, { approved: false }).ok, true);
  });

  it("rejects wrong types and extras", () => {
    const bad = validateTaskOutput(schema, { approved: "banana" });
    assert.equal(bad.ok, false);
    const extra = validateTaskInput(schema, { approved: true, x: 1 });
    assert.equal(extra.ok, false);
  });
});

describe("resolveTaskInput", () => {
  it("default fan-in", () => {
    const r = resolveTaskInput({
      dependencyIds: ["a", "b"],
      dependencyValues: { a: { findings: [1] }, b: { findings: [2] } }
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.input, {
        a: { findings: [1] },
        b: { findings: [2] }
      });
    }
  });

  it("maps outputPath to targetPath", () => {
    const r = resolveTaskInput({
      dependencyIds: ["research"],
      dependencyValues: {
        research: { findings: ["x"], company: "A" }
      },
      mappings: [
        {
          fromTask: "research",
          outputPath: "$.findings",
          targetPath: "$.research"
        }
      ]
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.input, { research: ["x"] });
  });

  it("root task uses staticInput or {}", () => {
    assert.deepEqual(
      resolveTaskInput({ dependencyIds: [], dependencyValues: {} }),
      { ok: true, input: {} }
    );
    assert.deepEqual(
      resolveTaskInput({
        dependencyIds: [],
        dependencyValues: {},
        staticInput: { toolName: "run_tests" }
      }),
      { ok: true, input: { toolName: "run_tests" } }
    );
  });
});

describe("emptyObjectSchema", () => {
  it("is a closed empty object", () => {
    const s = emptyObjectSchema();
    assert.equal(s.schemaVersion, 1);
    assert.equal(s.additionalProperties, false);
    assert.equal(validateTaskInput(s, {}).ok, true);
    assert.equal(validateTaskInput(s, { a: 1 }).ok, false);
  });
});

describe("taskSchemaToJsonSchema", () => {
  it("strips schemaVersion and detects schema-shaped values", async () => {
    const { taskSchemaToJsonSchema, looksLikeTaskSchemaDocument } =
      await import("./to-json-schema.js");
    const s = emptyObjectSchema();
    const json = taskSchemaToJsonSchema(s);
    assert.equal("schemaVersion" in json, false);
    assert.equal(json.type, "object");
    assert.equal(looksLikeTaskSchemaDocument(s), true);
    assert.equal(looksLikeTaskSchemaDocument({ profileUrl: "x" }), false);
    assert.equal(
      looksLikeTaskSchemaDocument({
        type: "object",
        properties: { name: "forge" }
      }),
      false
    );
    assert.equal(
      looksLikeTaskSchemaDocument({
        type: "object",
        properties: { findings: { type: "string" } }
      }),
      true
    );
  });
});
