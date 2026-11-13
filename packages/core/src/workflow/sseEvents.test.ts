import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLAN_SSE_EVENTS } from "./sseEvents.js";

describe("sseEvents", () => {
  it("names plan stream events", () => {
    assert.equal(PLAN_SSE_EVENTS.planPublished, "plan_published");
    assert.equal(PLAN_SSE_EVENTS.replan, "replan");
    assert.equal(PLAN_SSE_EVENTS.mergeConflict, "merge_conflict");
    assert.equal(PLAN_SSE_EVENTS.planningGate, "planning_gate");
  });
});
