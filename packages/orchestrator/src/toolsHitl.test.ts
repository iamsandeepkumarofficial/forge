import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeAskUser, executeSwitchMode } from "./tools.js";

describe("toolsHitl re-exports", () => {
  it("executeAskUser rejects missing kind or empty prompt", () => {
    assert.equal(
      executeAskUser({ kind: "other" as "mcq", prompt: "x" }).success,
      false
    );
    assert.equal(executeAskUser({ kind: "mcq", prompt: "   " }).success, false);
  });

  it("executeSwitchMode proposes outside auto", () => {
    const r = executeSwitchMode({
      currentMode: "ask",
      input: { target: "plan" }
    });
    assert.equal(r.metadata?.applied, false);
  });
});
