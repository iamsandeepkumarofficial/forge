import assert from "node:assert/strict";
import test from "node:test";
import { chunkTurnId } from "./reactLoopTools.js";

test("chunkTurnId prefers the child stream turn", () => {
  assert.equal(
    chunkTurnId({
      sessionId: "s",
      turnId: "parent",
      userText: "go",
      mode: "agent",
      provider: "openai",
      streamTurnId: "child"
    }),
    "child"
  );
});
