import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyObjectSchema } from "./schema-types.js";
import { validateTaskInput } from "./validate-input.js";

describe("validateTaskInput", () => {
  it("rejects a property that is not in the schema", () => {
    assert.equal(validateTaskInput(emptyObjectSchema(), { a: 1 }).ok, false);
  });
});
