import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_TASKS_PER_PLAN_VERSION, validatePlanDraft } from "@forge/core";
import {
  planDraftSchema,
  PLANNER_MAX_ATTEMPTS,
  DEFAULT_PLANNER_MAX_OUTPUT_TOKENS,
  DEFAULT_GATE_MAX_OUTPUT_TOKENS
} from "./plan.js";

describe("planDraftSchema", () => {
  it("accepts a valid plan with required fields", () => {
    const parsed = planDraftSchema.parse({
      goal: "Add auth",
      tasks: [
        {
          id: "inspect",
          description: "Inspect auth boundary",
          executor: "agent",
          dependencies: [],
          idempotent: false
        }
      ]
    });
    assert.equal(parsed.tasks[0]!.dependencies.length, 0);
    assert.equal(parsed.tasks[0]!.idempotent, false);
  });

  it(`rejects more than ${MAX_TASKS_PER_PLAN_VERSION} tasks`, () => {
    const tasks = Array.from(
      { length: MAX_TASKS_PER_PLAN_VERSION + 1 },
      (_, i) => ({
        id: `t${i}`,
        description: `Task ${i}`,
        executor: "agent" as const
      })
    );
    assert.throws(() => planDraftSchema.parse({ goal: "g", tasks }));
  });

  it("pairs with validatePlanDraft for cycle detection", () => {
    const parsed = planDraftSchema.parse({
      goal: "cycle",
      tasks: [
        {
          id: "a",
          description: "A",
          executor: "agent",
          dependencies: ["b"],
          idempotent: false
        },
        {
          id: "b",
          description: "B",
          executor: "agent",
          dependencies: ["a"],
          idempotent: false
        }
      ]
    });
    const validated = validatePlanDraft(parsed);
    assert.equal(validated.ok, false);
  });
});

describe("PLANNER_MAX_ATTEMPTS", () => {
  it("bounds retries to initial + one repair", () => {
    assert.equal(PLANNER_MAX_ATTEMPTS, 2);
  });
});

describe("planner output token defaults", () => {
  it("keeps a high planner default and a small gate default", () => {
    assert.equal(DEFAULT_PLANNER_MAX_OUTPUT_TOKENS, 16_384);
    assert.equal(DEFAULT_GATE_MAX_OUTPUT_TOKENS, 256);
  });
});
