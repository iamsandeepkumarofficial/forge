import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withSchemas } from "./testTaskDraft.js";

describe("withSchemas", () => {
  it("fills missing task schemas with an empty object", () => {
    const plan = withSchemas({
      goal: "Ship",
      tasks: [
        { id: "a", description: "Do", executor: "agent", dependencies: [] }
      ]
    });
    assert.equal(plan.tasks[0]?.inputSchema.type, "object");
    assert.equal(plan.tasks[0]?.outputSchema.additionalProperties, false);
  });
});
