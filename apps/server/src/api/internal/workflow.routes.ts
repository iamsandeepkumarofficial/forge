import { Router } from "express";
import {
  handleCreateOrUpdatePlan,
  handleGetPlan,
  handlePutPlanTasks,
  handlePatchPlanTask,
  handleCountRunningAgentTasks,
  handleEnsureTaskWorktree,
  handleMergeTaskWorktree
} from "./workflow.handlers.js";

export function mountWorkflowRoutes(router: Router): void {
  router.post("/workflow/plans", (req, res) => {
    return handleCreateOrUpdatePlan({ req, res });
  });
  router.get("/workflow/plans/:planId", (req, res) => {
    return handleGetPlan({ req, res });
  });
  router.put("/workflow/plans/:planId/tasks", (req, res) => {
    return handlePutPlanTasks({ req, res });
  });
  router.patch("/workflow/plans/:planId/tasks/:taskId", (req, res) => {
    return handlePatchPlanTask({ req, res });
  });
  router.get("/workflow/running-agent-tasks", (_req, res) => {
    return handleCountRunningAgentTasks({ res });
  });
  router.post("/workflow/task-worktree", (req, res) => {
    return handleEnsureTaskWorktree({ req, res });
  });
  router.post("/workflow/merge-task-worktree", (req, res) => {
    return handleMergeTaskWorktree({ req, res });
  });
}
