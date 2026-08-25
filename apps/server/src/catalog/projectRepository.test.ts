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

describe("ProjectRepository", () => {
  let ProjectRepository;
  const created = { id: "p1", name: "n", userId: "u1", dedupeKey: "o/r" };
  let selectRows = [];
  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          insert: () => chain([created]),
          select: () => chain(selectRows),
          delete: () => chain(undefined),
          update: () => chain(undefined)
        }),
        projects: {
          id: "id",
          userId: "userId",
          dedupeKey: "dedupeKey",
          lastActivityAt: "lastActivityAt"
        }
      }
    });
    ({ ProjectRepository } = await import("./projectRepository.js"));
  });
  it("createProject returns inserted project", async () => {
    const repo = new ProjectRepository();
    const row = await repo.createProject({
      userId: "u1",
      source: "github",
      dedupeKey: "o/r",
      name: "n",
      canonicalKey: null,
      status: "available"
    });
    assert.equal(row.id, "p1");
  });
  it("getById returns null when empty", async () => {
    selectRows = [];
    const repo = new ProjectRepository();
    assert.equal(await repo.getById("missing"), null);
  });
  it("getById returns first row", async () => {
    selectRows = [{ id: "p2" }];
    const repo = new ProjectRepository();
    assert.equal((await repo.getById("p2")).id, "p2");
  });
  it("findByDedupeKey / listByUserId / mutations run without throw", async () => {
    selectRows = [{ id: "p3", dedupeKey: "a/b" }];
    const repo = new ProjectRepository();
    assert.equal((await repo.findByDedupeKey("u1", "a/b")).id, "p3");
    assert.equal((await repo.listByUserId("u1")).length, 1);
    await repo.deleteProject("p3");
    await repo.updateStatus("p3", "unavailable");
    await repo.updateLastActivity("p3");
    await repo.updateCanonicalKey("p3", "canon");
  });
});
