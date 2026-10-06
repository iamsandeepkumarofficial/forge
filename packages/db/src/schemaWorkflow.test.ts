import assert from "node:assert/strict";
import { getTableName } from "drizzle-orm";
import { describe, it } from "node:test";
import { workflowPlans, workflowTasks } from "./schemaWorkflow.js";

describe("workflow schema", () => {
  it("exposes plan and task tables", () => {
    assert.equal(getTableName(workflowPlans), "workflow_plans");
    assert.equal(getTableName(workflowTasks), "workflow_tasks");
    assert.ok(workflowPlans.goal);
    assert.ok(workflowTasks.executor);
  });
});
