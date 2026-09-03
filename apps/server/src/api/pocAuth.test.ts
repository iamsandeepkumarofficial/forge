import assert from "node:assert/strict";
import { describe, it, mock, beforeEach } from "node:test";

describe("createLocalUserMiddleware", () => {
  let createLocalUserMiddleware: typeof import("./pocAuth.js").createLocalUserMiddleware;
  let formatAuthError: typeof import("./pocAuth.js").formatAuthError;
  let resetLocalUserCache: typeof import("../catalog/localUser.js").resetLocalUserCache;

  beforeEach(async () => {
    mock.reset();
    mock.module("../catalog/localUser.js", {
      namedExports: {
        getLocalUser: async () => ({
          id: "u1",
          email: "local@forge",
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        resetLocalUserCache: () => {},
        LOCAL_USER_EMAIL: "local@forge"
      }
    });
    ({ createLocalUserMiddleware, formatAuthError } = await import(
      "./pocAuth.js"
    ));
    ({ resetLocalUserCache } = await import("../catalog/localUser.js"));
    resetLocalUserCache();
  });

  it("sets forgeUser and calls next", async () => {
    const auth = createLocalUserMiddleware();
    const req = { headers: {} } as {
      headers: Record<string, string>;
      forgeUser?: { email: string };
    };
    let nextCalled = false;
    await auth(req as never, {} as never, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.forgeUser?.email, "local@forge");
  });

  it("formatAuthError surfaces nested AggregateError messages", () => {
    const err = Object.assign(new AggregateError([]), {
      message: "",
      code: "ECONNREFUSED",
      errors: [new Error("connect ECONNREFUSED 127.0.0.1:5433")]
    });
    assert.match(formatAuthError(err), /ECONNREFUSED 127\.0\.0\.1:5433/);
  });

  it("formatAuthError falls back for empty ECONNREFUSED", () => {
    const err = Object.assign(new Error(""), { code: "ECONNREFUSED" });
    assert.match(formatAuthError(err), /Postgres running/i);
  });
});
