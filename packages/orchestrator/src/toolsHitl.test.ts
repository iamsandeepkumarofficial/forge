import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeAskUser, executeSwitchMode } from "./toolsHitl.js";

describe("toolsHitl", () => {
  it("executeAskUser requires mcq options", () => {
    const r = executeAskUser({ kind: "mcq", prompt: "Pick", options: [] });
    assert.equal(r.success, false);
  });

  it("executeSwitchMode validates target", () => {
    const r = executeSwitchMode({
      currentMode: "ask",
      input: { target: "nope" }
    });
    assert.equal(r.success, false);
  });
});
