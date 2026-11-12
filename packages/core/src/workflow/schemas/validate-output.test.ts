import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateTaskOutput } from "./validate-output.js";

describe("validateTaskOutput", () => {
  it("rejects a string where a boolean is required", () => {
    const result = validateTaskOutput(
      {
        schemaVersion: 1,
        type: "object",
        additionalProperties: false,
        properties: { approved: { type: "boolean" } },
        required: ["approved"]
      },
      { approved: "banana" }
    );
    assert.equal(result.ok, false);
  });
});
