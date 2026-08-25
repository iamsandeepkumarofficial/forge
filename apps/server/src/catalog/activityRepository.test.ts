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

describe("ActivityRepository", () => {
  let ActivityRepository;
  let insertCalls = 0;
  let selectRows = [];
  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          insert: () => {
            insertCalls += 1;
            return chain([{ id: "a1", summary: "s", kind: "history" }]);
          },
          select: () => chain(selectRows)
        }),
        chatActivities: {
          chatFeatureId: "chatFeatureId",
          kind: "kind",
          createdAt: "createdAt"
        }
      }
    });
    ({ ActivityRepository } = await import("./activityRepository.js"));
  });
  it("create inserts and returns the row", async () => {
    insertCalls = 0;
    const repo = new ActivityRepository();
    const row = await repo.create({
      chatFeatureId: "cf1",
      kind: "history",
      actorType: "system",
      agentId: null,
      userId: null,
      summary: "s",
      detail: null
    });
    assert.equal(row.id, "a1");
    assert.equal(insertCalls, 1);
  });
  it("listByChatFeatureId returns selected rows", async () => {
    selectRows = [{ id: "a2", kind: "worklog" }];
    const repo = new ActivityRepository();
    const rows = await repo.listByChatFeatureId("cf1", {
      kind: "worklog",
      limit: 10
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "a2");
  });
});
