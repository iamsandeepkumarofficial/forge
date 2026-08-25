import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isLengthFinishReason,
  MAX_TOOL_ROUNDS,
  roundCapNotice,
  truncatedToolCallOutput
} from "./chatTurnLimits.js";

describe("chatTurnLimits", () => {
  it("raises the tool-round cap far above a single coding pass", () => {
    assert.equal(MAX_TOOL_ROUNDS >= 500, true);
  });

  it("treats provider length / max_tokens as truncated finish", () => {
    assert.equal(isLengthFinishReason("length"), true);
    assert.equal(isLengthFinishReason("LENGTH"), true);
    assert.equal(isLengthFinishReason("max_tokens"), true);
    assert.equal(isLengthFinishReason("stop"), false);
    assert.equal(isLengthFinishReason("tool-calls"), false);
  });

  it("asks the model to re-issue truncated tool calls", () => {
    assert.match(
      truncatedToolCallOutput("write_file"),
      /write_file.*output token limit.*Re-issue/
    );
  });

  it("explains the round cap so the user can continue", () => {
    assert.equal(
      roundCapNotice(500),
      "Stopped after 500 tool rounds. Send another message to continue."
    );
  });
});
