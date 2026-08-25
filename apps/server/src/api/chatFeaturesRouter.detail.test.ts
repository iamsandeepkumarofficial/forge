import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DescriptionValidationError,
  validateDescriptionDocument
} from "../catalog/descriptionDocument.js";
import {
  SINGLE_LEVEL_PARENT_ERROR,
  assertValidChatFeatureType,
  ChatFeatureValidationError,
  VALID_TYPES
} from "../projects/chatFeatureService.js";
describe("ticket detail validation helpers", () => {
  it("rejects invalid type with contract message shape", () => {
    assert.throws(
      () => assertValidChatFeatureType("epic"),
      (err: unknown) =>
        err instanceof ChatFeatureValidationError &&
        err.message ===
          `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`
    );
  });
  it("accepts preset types", () => {
    for (const type of VALID_TYPES) {
      assert.doesNotThrow(() => assertValidChatFeatureType(type));
    }
  });
  it("exposes the single-level parent error message", () => {
    assert.equal(
      SINGLE_LEVEL_PARENT_ERROR,
      "Only single-level parent/child is allowed"
    );
  });
  it("maps unsupported description blocks to contract error text", () => {
    assert.throws(
      () =>
        validateDescriptionDocument({
          version: 1,
          blocks: [{ type: "iframe" }]
        }),
      (err: unknown) =>
        err instanceof DescriptionValidationError &&
        err.message === "Unsupported description block: iframe"
    );
  });
});
