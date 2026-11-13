import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateTaskSchema } from "./validate-schema.js";

describe("validateTaskSchema", () => {
  it("requires schemaVersion 1", () => {
    assert.equal(validateTaskSchema({ type: "object" }).ok, false);
  });
});
