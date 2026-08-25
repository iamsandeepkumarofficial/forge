import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertValidChatFeatureType,
  VALID_TYPES,
  SINGLE_LEVEL_PARENT_ERROR,
  createChatFeaturesRouter
} from "./chatFeaturesRouter.js";
import { ChatFeatureValidationError } from "../projects/chatFeatureService.js";

describe("chatFeaturesRouter exports", () => {
  it("re-exports validation helpers", () => {
    assert.ok(VALID_TYPES.includes("feature"));
    assert.equal(SINGLE_LEVEL_PARENT_ERROR.includes("single-level"), true);
    assert.doesNotThrow(() => assertValidChatFeatureType("bug"));
    assert.throws(
      () => assertValidChatFeatureType("epic"),
      ChatFeatureValidationError
    );
  });
  it("createChatFeaturesRouter returns an express router with routes", () => {
    const router = createChatFeaturesRouter();
    assert.ok(Array.isArray(router.stack));
    assert.ok(router.stack.length > 0);
  });
});
