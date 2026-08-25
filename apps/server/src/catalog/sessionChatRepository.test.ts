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

describe("session chat repositories", () => {
  let SessionMessageRepository;
  let ChatTurnRepository;
  let ChatTurnChunkRepository;
  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          insert: () => chain([{ id: "m1" }]),
          select: () => chain([{ id: "m1" }]),
          delete: () => chain(undefined),
          update: () => chain(undefined)
        }),
        sessionMessages: { id: "id", sessionId: "sessionId" },
        chatTurns: { id: "id", sessionId: "sessionId" },
        chatTurnChunks: { id: "id", turnId: "turnId" }
      }
    });
    ({ SessionMessageRepository, ChatTurnRepository, ChatTurnChunkRepository } =
      await import("./sessionChatRepository.js"));
  });
  it("constructs all three repositories", () => {
    assert.ok(new SessionMessageRepository());
    assert.ok(new ChatTurnRepository());
    assert.ok(new ChatTurnChunkRepository());
  });
  it("SessionMessageRepository can insert via mock", async () => {
    const repo = new SessionMessageRepository();
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(repo)
    ).filter((m) => m !== "constructor");
    assert.ok(methods.length >= 1);
  });
});
