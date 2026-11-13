import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyObjectSchema } from "./schema-types.js";

describe("emptyObjectSchema", () => {
  it("is a closed empty object", () => {
    const schema = emptyObjectSchema();
    assert.equal(schema.schemaVersion, 1);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.properties, {});
  });
});
