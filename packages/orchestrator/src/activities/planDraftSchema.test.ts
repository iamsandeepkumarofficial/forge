import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_TASKS_PER_PLAN_VERSION,
  emptyObjectSchema,
  validatePlanDraft
} from "@forge/core";
import {
  planDraftSchema,
  coercePlannerTaskDraft,
  formatPlannerChatExcerpt,
  PLANNER_MAX_ATTEMPTS,
  DEFAULT_PLANNER_MAX_OUTPUT_TOKENS,
  DEFAULT_GATE_MAX_OUTPUT_TOKENS
} from "./plan.js";

const schema = emptyObjectSchema();

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
          idempotent: false,
          inputSchema: schema,
          outputSchema: schema
        }
      ]
    });
    assert.equal(parsed.tasks[0]!.dependencies.length, 0);
    assert.equal(parsed.tasks[0]!.idempotent, false);
  });

  it("accepts fluid sections, isolation, and task rationale", () => {
    const parsed = planDraftSchema.parse({
      goal: "Add auth",
      sections: [
        { title: "Problem", body: "No session boundary" },
        { title: "Risks", body: "Breaking sessions" }
      ],
      tasks: [
        {
          id: "inspect",
          description: "Inspect auth boundary",
          rationale: "Map what exists first",
          isolation: "child",
          executor: "agent",
          dependencies: [],
          idempotent: true,
          inputSchema: schema,
          outputSchema: schema
        }
      ]
    });
    assert.deepEqual(parsed.sections, [
      { title: "Problem", body: "No session boundary" },
      { title: "Risks", body: "Breaking sessions" }
    ]);
    assert.equal(parsed.tasks[0]!.rationale, "Map what exists first");
    assert.equal(parsed.tasks[0]!.isolation, "child");
    const validated = validatePlanDraft(parsed);
    assert.equal(validated.ok, true);
    if (validated.ok) {
      assert.equal(validated.plan.sections?.[1]?.title, "Risks");
      assert.equal(validated.plan.tasks[0]!.rationale, "Map what exists first");
      assert.equal(validated.plan.tasks[0]!.isolation, "child");
    }
  });

  it("accepts a plan with tasks only (no sections)", () => {
    const parsed = planDraftSchema.parse({
      goal: "Quick fix",
      tasks: [
        {
          id: "fix",
          description: "Fix the bug",
          executor: "agent",
          dependencies: [],
          idempotent: false,
          inputSchema: schema,
          outputSchema: schema
        }
      ]
    });
    assert.equal(parsed.sections, undefined);
    assert.equal(validatePlanDraft(parsed).ok, true);
  });

  it("coerces omitted dependencies, schemas, and description aliases", () => {
    const coerced = coercePlannerTaskDraft({
      id: "research-a",
      title: "Research A",
      executor: "agent"
    }) as Record<string, unknown>;
    assert.equal(coerced.description, "Research A");
    assert.deepEqual(coerced.dependencies, []);
    assert.equal(coerced.idempotent, false);
    assert.equal(
      (coerced.inputSchema as { schemaVersion: number }).schemaVersion,
      1
    );

    const parsed = planDraftSchema.parse({
      goal: "Research",
      tasks: [
        {
          id: "research-a",
          title: "Research A",
          executor: "agent"
        }
      ]
    });
    assert.equal(parsed.tasks[0]!.description, "Research A");
    assert.deepEqual(parsed.tasks[0]!.dependencies, []);
  });

  it(`rejects more than ${MAX_TASKS_PER_PLAN_VERSION} tasks`, () => {
    const tasks = Array.from(
      { length: MAX_TASKS_PER_PLAN_VERSION + 1 },
      (_, i) => ({
        id: `t${i}`,
        description: `Task ${i}`,
        executor: "agent" as const,
        inputSchema: schema,
        outputSchema: schema
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
          idempotent: false,
          inputSchema: schema,
          outputSchema: schema
        },
        {
          id: "b",
          description: "B",
          executor: "agent",
          dependencies: ["a"],
          idempotent: false,
          inputSchema: schema,
          outputSchema: schema
        }
      ]
    });
    const validated = validatePlanDraft(parsed);
    assert.equal(validated.ok, false);
  });

  it("rejects invented schema keywords", () => {
    const parsed = planDraftSchema.safeParse({
      goal: "g",
      tasks: [
        {
          id: "a",
          description: "A",
          executor: "agent",
          dependencies: [],
          idempotent: false,
          inputSchema: schema,
          outputSchema: {
            schemaVersion: 1,
            type: "object",
            inventedKeyword: true
          }
        }
      ]
    });
    assert.equal(parsed.success, false);
  });
});

describe("formatPlannerChatExcerpt", () => {
  it("keeps recent user/assistant text for the planner", () => {
    const excerpt = formatPlannerChatExcerpt([
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "I need auth" }]
      },
      {
        id: "2",
        role: "assistant",
        parts: [{ type: "text", text: "What kind?" }]
      },
      {
        id: "3",
        role: "tool",
        parts: [{ type: "text", text: "ignored" }]
      },
      {
        id: "4",
        role: "user",
        parts: [{ type: "text", text: "Session cookies" }]
      }
    ]);
    assert.match(excerpt, /I need auth/);
    assert.match(excerpt, /Session cookies/);
    assert.equal(excerpt.includes("ignored"), false);
  });
});

describe("PLANNER_MAX_ATTEMPTS", () => {
  it("bounds retries to initial + one repair", () => {
    assert.equal(PLANNER_MAX_ATTEMPTS, 2);
  });
});

describe("planner output token defaults", () => {
  it("keeps a high planner default and a smaller gate default", () => {
    assert.equal(DEFAULT_PLANNER_MAX_OUTPUT_TOKENS, 16_384);
    assert.equal(DEFAULT_GATE_MAX_OUTPUT_TOKENS, 800);
  });
});
