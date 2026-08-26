import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorizePreviewAccess,
  readRequestAuth
} from "./authorize.js";

describe("authorizePreviewAccess", () => {
  it("allows access without token or email (RFC 0004)", () => {
    const decision = authorizePreviewAccess({
      sessionId: "s1",
      expectedToken: "ignored",
      ownerEmail: "alice@x.com"
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.email, "local@forge");
    }
  });
});

describe("readRequestAuth", () => {
  it("returns empty auth", () => {
    assert.deepEqual(readRequestAuth({}), {});
  });
});
