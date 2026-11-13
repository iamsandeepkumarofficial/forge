import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyObjectSchema } from "./schema-types.js";
import {
  looksLikeTaskSchemaDocument,
  taskSchemaToJsonSchema
} from "./to-json-schema.js";

describe("taskSchemaToJsonSchema", () => {
  it("strips schemaVersion", () => {
    const json = taskSchemaToJsonSchema(emptyObjectSchema());
    assert.equal("schemaVersion" in json, false);
    assert.equal(looksLikeTaskSchemaDocument(emptyObjectSchema()), true);
  });
});
