import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLANNER_MAX_ATTEMPTS, planDraftSchema } from "./planInvoke.js";

describe("planInvoke", () => {
  it("caps planner attempts", () => {
    assert.equal(PLANNER_MAX_ATTEMPTS, 2);
    const parsed = planDraftSchema.safeParse({
      goal: "Ship auth",
      tasks: [
        {
          id: "inspect",
          description: "Read the repo",
          executor: "agent",
          dependencies: [],
          idempotent: true
        }
      ]
    });
    assert.equal(parsed.success, true);
  });
});
