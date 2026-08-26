import assert from "node:assert/strict";
import { describe, it, mock, beforeEach } from "node:test";

describe("createLocalUserMiddleware", () => {
  let createLocalUserMiddleware: typeof import("./pocAuth.js").createLocalUserMiddleware;
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
    ({ createLocalUserMiddleware } = await import("./pocAuth.js"));
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
});
