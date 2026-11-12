import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readyTaskIds,
  topoSort,
  validatePlanDraft,
  emptyObjectSchema,
  MAX_TASKS_PER_PLAN_VERSION
} from "./index.js";

const schema = emptyObjectSchema();

function task(partial: {
  id: string;
  description: string;
  executor?: "agent" | "tool" | "human";
  dependencies?: string[];
  inputSchema?: unknown;
  outputSchema?: unknown;
  inputMappings?: unknown;
}) {
  return {
    executor: "agent" as const,
    inputSchema: schema,
    outputSchema: schema,
    ...partial
  };
}

describe("validatePlanDraft", () => {
  it("preserves fluid sections, isolation, and task rationale", () => {
    const r = validatePlanDraft({
      goal: "Ship auth",
      sections: [
        { title: "Problem", body: "Missing login" },
        { title: "Risks", body: "Breaking existing sessions" },
        { title: "  ", body: "ignored" },
        { title: "Empty body", body: "  " }
      ],
      tasks: [
        {
          ...task({ id: "inspect", description: "Inspect" }),
          isolation: "child",
          rationale: "Need a map"
        },
        {
          ...task({
            id: "impl",
            description: "Implement",
            dependencies: ["inspect"]
          }),
          isolation: "bogus" as "inline"
        }
      ]
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.plan.sections, [
        { title: "Problem", body: "Missing login" },
        { title: "Risks", body: "Breaking existing sessions" }
      ]);
      assert.equal(r.plan.tasks[0]!.isolation, "child");
      assert.equal(r.plan.tasks[0]!.rationale, "Need a map");
      assert.equal(r.plan.tasks[1]!.isolation, undefined);
    }
  });

  it("rejects task ids that are not path-safe", () => {
    const r = validatePlanDraft({
      goal: "g",
      tasks: [task({ id: "../escape", description: "Bad" })]
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.errors[0]?.code, "invalid_id");
  });

  it("rejects empty tasks", () => {
    const r = validatePlanDraft({ goal: "g", tasks: [] });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.errors[0]?.code, "empty_tasks");
  });

  it("rejects more than max tasks", () => {
    const tasks = Array.from(
      { length: MAX_TASKS_PER_PLAN_VERSION + 1 },
      (_, i) => task({ id: `t${i}`, description: `Task ${i}` })
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
        task({
          id: "a",
          description: "A",
          dependencies: ["missing"]
        })
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
        task({ id: "a", description: "A", dependencies: ["b"] }),
        task({ id: "b", description: "B", dependencies: ["a"] })
      ]
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.some((e) => e.code === "cycle"));
  });

  it("rejects missing schemas", () => {
    const r = validatePlanDraft({
      goal: "g",
      tasks: [{ id: "a", description: "A", executor: "agent" }]
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === "invalid_schema"));
    }
  });

  it("rejects invented schema keywords", () => {
    const r = validatePlanDraft({
      goal: "g",
      tasks: [
        task({
          id: "a",
          description: "A",
          outputSchema: {
            schemaVersion: 1,
            type: "object",
            inventedKeyword: "nope"
          }
        })
      ]
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === "invalid_schema"));
    }
  });

  it("rejects mapping from non-dependency", () => {
    const r = validatePlanDraft({
      goal: "g",
      tasks: [
        task({ id: "a", description: "A" }),
        task({
          id: "b",
          description: "B",
          dependencies: ["a"],
          inputMappings: [{ fromTask: "missing" }]
        })
      ]
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === "invalid_mapping"));
    }
  });

  it("accepts a valid DAG with schemas", () => {
    const r = validatePlanDraft({
      goal: "Ship it",
      tasks: [
        task({ id: "a", description: "Inspect" }),
        task({
          id: "b",
          description: "Build",
          dependencies: ["a"]
        })
      ]
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.plan.tasks[0]?.inputSchema.additionalProperties, false);
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

  it("rejects root tasks whose inputSchema requires fields missing from input", () => {
    const r = validatePlanDraft({
      goal: "Research",
      tasks: [
        task({
          id: "research",
          description: "Research a profile",
          inputSchema: {
            schemaVersion: 1,
            type: "object",
            additionalProperties: false,
            properties: { url: { type: "string" } },
            required: ["url"]
          }
        })
      ]
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === "invalid_root_input"));
    }
  });

  it("accepts root tasks that supply required input values", () => {
    const r = validatePlanDraft({
      goal: "Research",
      tasks: [
        {
          ...task({
            id: "research",
            description: "Research a profile",
            inputSchema: {
              schemaVersion: 1,
              type: "object",
              additionalProperties: false,
              properties: { url: { type: "string" } },
              required: ["url"]
            }
          }),
          input: { url: "https://github.com/example" }
        }
      ]
    });
    assert.equal(r.ok, true);
  });
});
