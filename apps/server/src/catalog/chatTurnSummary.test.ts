import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChatTurnSummary } from "./chatTurnSummary.js";

describe("parseChatTurnSummary", () => {
  it("accepts a complete summary", () => {
    assert.deepEqual(
      parseChatTurnSummary({
        rounds: 2,
        toolCallCount: 3,
        toolNames: ["read_file", "run_terminal"],
        hitRoundCap: false
      }),
      {
        rounds: 2,
        toolCallCount: 3,
        toolNames: ["read_file", "run_terminal"],
        hitRoundCap: false
      }
    );
  });

  it("rejects incomplete or invalid payloads", () => {
    assert.equal(parseChatTurnSummary(undefined), undefined);
    assert.equal(parseChatTurnSummary({}), undefined);
    assert.equal(
      parseChatTurnSummary({
        rounds: -1,
        toolCallCount: 0,
        toolNames: [],
        hitRoundCap: false
      }),
      undefined
    );
    assert.equal(
      parseChatTurnSummary({
        rounds: 1,
        toolCallCount: 1,
        toolNames: [1],
        hitRoundCap: false
      }),
      undefined
    );
  });
});
