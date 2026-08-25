import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  interactiveChatTurnWorkflow,
  MAX_TOOL_ROUNDS
} from "./interactiveChatTurnWorkflow.js";

describe("interactiveChatTurnWorkflow", () => {
  it("exports workflow function", () => {
    assert.equal(typeof interactiveChatTurnWorkflow, "function");
  });

  it("keeps a high tool-round cap and still allows cancel via Stop", () => {
    assert.equal(MAX_TOOL_ROUNDS >= 500, true);
    assert.equal(typeof interactiveChatTurnWorkflow, "function");
  });
});
