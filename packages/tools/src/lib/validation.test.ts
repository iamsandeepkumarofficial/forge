import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ToolParameterSchema } from "./validation.js";

function describeParameter(schema: ToolParameterSchema): string {
  const req = schema.required ? "required" : "optional";
  const detail = schema.description ? ` — ${schema.description}` : "";
  return `${schema.type} (${req})${detail}`;
}

describe("ToolParameterSchema", () => {
  it("describes a required string parameter", () => {
    const schema: ToolParameterSchema = {
      type: "string",
      required: true,
      description: "Relative file path"
    };
    assert.equal(
      describeParameter(schema),
      "string (required) — Relative file path"
    );
  });

  it("treats missing required as optional", () => {
    const schema: ToolParameterSchema = { type: "boolean" };
    assert.equal(describeParameter(schema), "boolean (optional)");
    assert.equal(schema.required, undefined);
    assert.equal(schema.description, undefined);
  });

  it("supports nested-style parameter metadata used by tools", () => {
    const params: Record<string, ToolParameterSchema> = {
      path: { type: "string", required: true },
      replaceAll: { type: "boolean", description: "Replace every match" }
    };
    assert.equal(params.path?.required, true);
    assert.equal(params.replaceAll?.type, "boolean");
    assert.match(describeParameter(params.replaceAll!), /optional/);
  });
});
