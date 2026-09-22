import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Router } from "express";
import { mountWorkflowRoutes } from "./workflow.routes.js";

function routePaths(router: Router): string[] {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => {
      const method = Object.keys(layer.route!.methods)[0] ?? "";
      return `${method.toUpperCase()} ${layer.route!.path}`;
    });
}

describe("mountWorkflowRoutes", () => {
  it("registers plan and worktree routes", () => {
    const router = Router();
    mountWorkflowRoutes(router);
    const paths = routePaths(router);
    assert.ok(paths.includes("POST /workflow/plans"));
    assert.ok(paths.includes("GET /workflow/plans/:planId"));
    assert.ok(paths.includes("PUT /workflow/plans/:planId/tasks"));
    assert.ok(paths.includes("PATCH /workflow/plans/:planId/tasks/:taskId"));
    assert.ok(paths.includes("GET /workflow/running-agent-tasks"));
    assert.ok(paths.includes("POST /workflow/task-worktree"));
    assert.ok(paths.includes("POST /workflow/merge-task-worktree"));
  });
});
