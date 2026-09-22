import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planningGateShortcut } from "@forge/core";

describe("runPlanningGate shortcuts (via core)", () => {
  it("plan mode always needs planning without LLM", () => {
    const r = planningGateShortcut({
      userText: "Hi",
      mode: "plan"
    });
    assert.deepEqual(r, { needsPlanning: true, reason: "plan_mode" });
  });

  it("ask mode never needs planning", () => {
    const r = planningGateShortcut({
      userText: "Add auth and tests",
      mode: "ask"
    });
    assert.deepEqual(r, { needsPlanning: false, reason: "ask_mode" });
  });
});
