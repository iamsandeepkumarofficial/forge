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

describe("ChatFeatureRepository", () => {
  let ChatFeatureRepository;
  const selectRows = [{ id: "c1", sessionId: "s1", projectId: "p1" }];
  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          insert: () => chain([{ id: "c1", title: "New" }]),
          select: () => chain(selectRows),
          delete: () => chain(undefined),
          update: () => chain(undefined)
        }),
        chatFeatures: {
          id: "id",
          projectId: "projectId",
          sessionId: "sessionId",
          kind: "kind",
          order: "order",
          lastActivityAt: "lastActivityAt",
          parentId: "parentId"
        }
      }
    });
    ({ ChatFeatureRepository } = await import("./chatFeatureRepository.js"));
  });
  it("createChatFeature returns inserted feature", async () => {
    const repo = new ChatFeatureRepository();
    const row = await repo.createChatFeature({
      projectId: "p1",
      userId: "u1",
      title: "New",
      kind: "ticket",
      type: "feature",
      parentId: null,
      status: "no_section",
      priority: "medium",
      dueDate: null,
      description: null,
      order: 0,
      branchName: "b",
      sessionId: "s1",
      workflowId: "w"
    });
    assert.equal(row.id, "c1");
  });
  it("getById and getBySessionId return rows", async () => {
    const repo = new ChatFeatureRepository();
    assert.equal((await repo.getById("c1")).id, "c1");
    assert.equal((await repo.getBySessionId("s1")).sessionId, "s1");
  });
  it("listByProjectId returns array", async () => {
    const repo = new ChatFeatureRepository();
    assert.equal((await repo.listByProjectId("p1")).length, 1);
  });
});
