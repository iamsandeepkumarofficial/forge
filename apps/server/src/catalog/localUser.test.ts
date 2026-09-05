import { describe, it, mock, before, afterEach } from "node:test";
import assert from "node:assert/strict";

describe("localUser", () => {
  let getLocalUser: typeof import("./localUser.js").getLocalUser;
  let resetLocalUserCache: typeof import("./localUser.js").resetLocalUserCache;
  let LOCAL_USER_EMAIL: typeof import("./localUser.js").LOCAL_USER_EMAIL;
  let createCalls = 0;

  before(async () => {
    mock.module("./repository.js", {
      exports: {
        CatalogRepository: class {
          async getOrCreateUser(email: string) {
            createCalls += 1;
            return { id: "u-local", email };
          }
        }
      }
    });
    ({ getLocalUser, resetLocalUserCache, LOCAL_USER_EMAIL } =
      await import("./localUser.js"));
  });

  afterEach(() => {
    resetLocalUserCache();
    createCalls = 0;
  });

  it("uses the local forge email", () => {
    assert.equal(LOCAL_USER_EMAIL, "local@forge");
  });

  it("caches the user after the first lookup", async () => {
    const first = await getLocalUser();
    const second = await getLocalUser();
    assert.equal(first.id, "u-local");
    assert.equal(first.email, "local@forge");
    assert.equal(second, first);
    assert.equal(createCalls, 1);
  });

  it("resetLocalUserCache forces a new lookup", async () => {
    await getLocalUser();
    resetLocalUserCache();
    await getLocalUser();
    assert.equal(createCalls, 2);
  });
});
