import assert from "node:assert/strict";
import test from "node:test";
import { assistantPartsForStep } from "./reactLoopRun.js";

test("assistantPartsForStep includes text when the step has text", () => {
  const parts = assistantPartsForStep({
    text: "hello",
    toolCalls: []
  });
  assert.deepEqual(parts, [{ type: "text", text: "hello" }]);
});
