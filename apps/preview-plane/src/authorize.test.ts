import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizePreviewAccess, readRequestAuth } from "./authorize.js";

const TOKEN = "poc-token";

describe("authorizePreviewAccess", () => {
  it("denies missing token as 401", () => {
    const d = authorizePreviewAccess({
      sessionId: "s1",
      expectedToken: TOKEN,
      requestEmail: "a@x.com"
    });
    assert.deepEqual(d, { ok: false, status: 401 });
  });

  it("denies owner mismatch as 403", () => {
    const d = authorizePreviewAccess({
      sessionId: "s1",
      expectedToken: TOKEN,
      requestToken: TOKEN,
      requestEmail: "bob@x.com",
      ownerEmail: "alice@x.com"
    });
    assert.deepEqual(d, { ok: false, status: 403 });
  });

  it("allows matching token and owner", () => {
    const d = authorizePreviewAccess({
      sessionId: "s1",
      expectedToken: TOKEN,
      requestToken: TOKEN,
      requestEmail: "alice@x.com",
      ownerEmail: "alice@x.com"
    });
    assert.deepEqual(d, { ok: true, email: "alice@x.com" });
  });
});

describe("readRequestAuth", () => {
  it("reads bearer and email headers", () => {
    const auth = readRequestAuth({
      authorization: "Bearer abc",
      "x-forge-user-email": "dev@local.forge"
    });
    assert.deepEqual(auth, { token: "abc", email: "dev@local.forge" });
  });
});
