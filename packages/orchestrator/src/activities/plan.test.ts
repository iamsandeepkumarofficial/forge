import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLANNER_MAX_ATTEMPTS } from "./plan.js";

describe("plan activities", () => {
  it("exports the planner attempt bound", () => {
    assert.equal(PLANNER_MAX_ATTEMPTS, 2);
  });
});
