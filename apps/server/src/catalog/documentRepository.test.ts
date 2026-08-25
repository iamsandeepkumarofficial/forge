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

describe("DocumentRepository", () => {
  let DocumentRepository;
  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          insert: () => chain([{ id: "d1", title: "t" }]),
          select: () => chain([{ id: "d1", title: "t" }]),
          delete: () => chain(undefined),
          update: () => chain(undefined)
        }),
        documents: { id: "id", projectId: "projectId", userId: "userId" }
      }
    });
    ({ DocumentRepository } = await import("./documentRepository.js"));
  });
  it("exposes create/list/get methods that hit mocked db", async () => {
    const repo = new DocumentRepository();
    assert.equal(typeof repo.create, "function");
    const created = await repo.create({
      userId: "u1",
      projectId: "p1",
      title: "t",
      body: "b",
      source: "user"
    });
    assert.equal(created.id, "d1");
  });
});
