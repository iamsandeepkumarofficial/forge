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
    "delete"
  ]) {
    api[m] = () => api;
  }
  api.returning = async () => finalValue;
  Object.assign(api, thenable(finalValue));
  return api;
}
describe("LinkedItemRepository", () => {
  let LinkedItemRepository;
  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          insert: () => chain([{ id: "l1" }]),
          select: () => chain([{ id: "l1" }]),
          delete: () => chain(undefined)
        }),
        chatLinkedItems: {
          id: "id",
          chatFeatureId: "chatFeatureId",
          createdAt: "createdAt"
        }
      }
    });
    ({ LinkedItemRepository } = await import("./linkedItemRepository.js"));
  });
  it("create returns inserted linked item", async () => {
    const repo = new LinkedItemRepository();
    const created = await repo.create({
      chatFeatureId: "c1",
      label: "t",
      url: "https://example.com",
      externalKey: null
    });
    assert.equal(created.id, "l1");
  });
  it("listByChatFeatureId returns rows", async () => {
    const repo = new LinkedItemRepository();
    assert.equal((await repo.listByChatFeatureId("c1")).length, 1);
  });
});
