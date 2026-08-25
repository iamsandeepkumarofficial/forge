import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

function thenable(value) {
  return {
    then(onFulfilled, onRejected) {
      return Promise.resolve(value).then(onFulfilled, onRejected);
    }
  };
}
function chain(finalValue) {
  const api = {};
  for (const m of [
    "select",
    "from",
    "where",
    "orderBy",
    "limit",
    "insert",
    "values",
    "returning",
    "update",
    "set",
    "delete",
    "onConflictDoNothing",
    "onConflictDoUpdate"
  ]) {
    api[m] = (..._args) => api;
  }
  api.returning = async () => finalValue;
  Object.assign(api, thenable(finalValue));
  return api;
}

describe("CatalogRepository", () => {
  let CatalogRepository;
  let selectRows = [];
  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          insert: () => chain([{ id: "u1", email: "a@b.c" }]),
          select: () => chain(selectRows),
          delete: () => chain(undefined),
          update: () => chain(undefined)
        }),
        users: { id: "id", email: "email" },
        conversations: { id: "id", userId: "userId", updatedAt: "updatedAt" },
        uiState: { id: "id", userId: "userId", key: "key" }
      }
    });
    ({ CatalogRepository } = await import("./repository.js"));
  });
  it("findUserByEmail returns null when missing", async () => {
    selectRows = [];
    const repo = new CatalogRepository();
    assert.equal(await repo.findUserByEmail("x@y.z"), null);
  });
  it("getOrCreateUser returns existing user", async () => {
    selectRows = [{ id: "u9", email: "e@x.com" }];
    const repo = new CatalogRepository();
    const user = await repo.getOrCreateUser("e@x.com");
    assert.equal(user.id, "u9");
  });
  it("getActiveSessionId is a no-op null", async () => {
    const repo = new CatalogRepository();
    assert.equal(await repo.getActiveSessionId("u1"), null);
    await repo.setActiveSessionId("u1", "s1");
  });
});
