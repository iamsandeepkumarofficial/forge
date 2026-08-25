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
    "innerJoin",
    "groupBy"
  ]) {
    api[m] = () => api;
  }
  api.returning = async () => finalValue;
  Object.assign(api, thenable(finalValue));
  return api;
}
describe("ChatCommentRepository", () => {
  let ChatCommentRepository;
  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          insert: () => chain([{ id: "cm1", text: "hi" }]),
          select: () => chain([{ id: "cm1", text: "hi" }])
        }),
        chatComments: {
          id: "id",
          chatFeatureId: "chatFeatureId",
          createdAt: "createdAt"
        },
        chatFeatures: { id: "id", projectId: "projectId" }
      }
    });
    ({ ChatCommentRepository } = await import("./chatCommentRepository.js"));
  });
  it("create returns inserted comment", async () => {
    const repo = new ChatCommentRepository();
    const row = await repo.create({
      chatFeatureId: "c1",
      userId: "u1",
      text: "hi",
      agentId: null,
      documentId: null
    });
    assert.equal(row.id, "cm1");
  });
  it("listByChatFeatureId returns rows", async () => {
    const repo = new ChatCommentRepository();
    assert.equal((await repo.listByChatFeatureId("c1")).length, 1);
  });
});
