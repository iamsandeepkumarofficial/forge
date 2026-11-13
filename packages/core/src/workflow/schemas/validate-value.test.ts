import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateAgainstSchema } from "./validate-value.js";

describe("validateAgainstSchema", () => {
  it("reports a type mismatch", () => {
    const errors = validateAgainstSchema({
      schema: { type: "boolean" },
      value: "banana"
    });
    assert.equal(errors[0]?.code, "type_mismatch");
  });
});
