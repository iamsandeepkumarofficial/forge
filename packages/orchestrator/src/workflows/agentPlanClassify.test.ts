import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftToTasks } from "./agentWorkflowModel.js";
import {
  applyAnswerToTasks,
  collectTaskBuckets,
  formatPlanMarkdown,
  keepCompletedOnReplan,
  planTurnSummary,
  resultStatusForPlan,
  retryableFailedTasks,
  tasksForPersist
} from "./agentPlanClassify.js";

const draft = {
  goal: "Ship auth",
  tasks: [
    {
      id: "inspect",
      description: "Read the repo",
      executor: "agent" as const,
      dependencies: [] as string[],
      idempotent: true
    },
    {
      id: "implement",
      description: "Write the code",
      executor: "agent" as const,
      dependencies: ["inspect"],
      idempotent: false
    }
  ]
};

describe("agentPlanClassify", () => {
  it("groups tasks by status", () => {
    const tasks = draftToTasks(draft);
    tasks[0]!.status = "completed";
    tasks[1]!.status = "failed";
    const buckets = collectTaskBuckets(tasks);
    assert.equal(buckets.completed.has("inspect"), true);
    assert.equal(buckets.failed[0]?.id, "implement");
  });

  it("resumes waiting tasks for an answer", () => {
    const tasks = draftToTasks(draft);
    tasks[0]!.status = "waiting";
    const matched = applyAnswerToTasks({ tasks, taskId: "inspect" });
    assert.equal(matched[0]?.id, "inspect");
    assert.equal(applyAnswerToTasks({ tasks, taskId: "missing" }).length, 0);
  });

  it("retries only idempotent failed tasks", () => {
    const tasks = draftToTasks(draft);
    tasks[0]!.status = "failed";
    tasks[0]!.attemptCount = 1;
    tasks[1]!.status = "failed";
    const retryable = retryableFailedTasks(tasks);
    assert.equal(retryable[0]?.id, "inspect");
  });

  it("keeps completed ids across a replan", () => {
    const next = keepCompletedOnReplan({
      next: draftToTasks(draft),
      completedIds: new Set(["inspect"])
    });
    assert.equal(next[0]?.status, "completed");
    assert.equal(next[1]?.status, "pending");
  });

  it("formats plan markdown and summaries", () => {
    const tasks = draftToTasks(draft);
    const md = formatPlanMarkdown({ goal: "Ship auth", tasks });
    assert.match(md, /Ship auth/);
    assert.match(md, /inspect/);
    assert.equal(
      planTurnSummary({ status: "completed", taskCount: 2 }),
      "Plan completed (2 tasks)."
    );
    assert.equal(resultStatusForPlan("cancelled"), "cancelled");
    assert.equal(tasksForPersist(tasks)[0]?.id, "inspect");
  });
});
