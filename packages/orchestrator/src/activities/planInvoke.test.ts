import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyObjectSchema } from "@forge/core";
import { PLANNER_MAX_ATTEMPTS, planDraftSchema } from "./planInvoke.js";

const schema = emptyObjectSchema();

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
          idempotent: true,
          inputSchema: schema,
          outputSchema: schema
        }
      ]
    });
    assert.equal(parsed.success, true);
  });
});
