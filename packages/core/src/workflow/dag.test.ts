import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readyTaskIds,
  topoSort,
  validatePlanDraft,
  MAX_TASKS_PER_PLAN_VERSION
} from "./index.js";

describe("validatePlanDraft", () => {
  it("rejects empty tasks", () => {
    const r = validatePlanDraft({ goal: "g", tasks: [] });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.errors[0]?.code, "empty_tasks");
  });

  it("rejects more than max tasks", () => {
    const tasks = Array.from(
      { length: MAX_TASKS_PER_PLAN_VERSION + 1 },
      (_, i) => ({
        id: `t${i}`,
        description: `Task ${i}`,
        executor: "agent" as const
      })
    );
    const r = validatePlanDraft({ goal: "g", tasks });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === "too_many_tasks"));
    }
  });

  it("rejects missing dependency", () => {
    const r = validatePlanDraft({
      goal: "g",
      tasks: [
        {
          id: "a",
          description: "A",
          executor: "agent",
          dependencies: ["missing"]
        }
      ]
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === "missing_dependency"));
    }
  });

  it("rejects cycles", () => {
    const r = validatePlanDraft({
      goal: "g",
      tasks: [
        {
          id: "a",
          description: "A",
          executor: "agent",
          dependencies: ["b"]
        },
        {
          id: "b",
          description: "B",
          executor: "agent",
          dependencies: ["a"]
        }
      ]
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.some((e) => e.code === "cycle"));
  });

  it("accepts a valid DAG", () => {
    const r = validatePlanDraft({
      goal: "Ship it",
      tasks: [
        { id: "a", description: "Inspect", executor: "agent" },
        {
          id: "b",
          description: "Build",
          executor: "agent",
          dependencies: ["a"]
        }
      ]
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(topoSort(r.plan.tasks)?.[0], "a");
      assert.deepEqual(
        readyTaskIds(
          r.plan.tasks.map((t) => ({
            ...t,
            status: "pending"
          })),
          new Set()
        ),
        ["a"]
      );
    }
  });
});
