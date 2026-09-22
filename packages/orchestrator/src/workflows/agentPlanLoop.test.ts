import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyChildResult,
  createPlanRunContext,
  runPlanExecutionLoop
} from "./agentPlanLoop.js";
import { draftToTasks } from "./agentWorkflowModel.js";

describe("agentPlanLoop", () => {
  it("exports the plan loop helpers", () => {
    assert.equal(typeof runPlanExecutionLoop, "function");
    assert.equal(typeof applyChildResult, "function");
    assert.equal(typeof createPlanRunContext, "function");
  });

  it("applies a completed child onto task state", async () => {
    const ctx = createPlanRunContext({
      args: {
        sessionId: "s",
        turnId: "t",
        userText: "hi",
        mode: "agent",
        provider: "openai"
      },
      workflowId: "wf",
      planId: "p1",
      goal: "Ship",
      tasks: draftToTasks({
        goal: "Ship",
        tasks: [
          { id: "a", description: "Do it", executor: "agent", dependencies: [] }
        ]
      }),
      short: {
        mergeTaskWorktree: async () => ({ ok: true })
      } as never,
      planner: {} as never,
      maxConcurrency: 2
    });
    await applyChildResult({
      ctx,
      taskId: "a",
      result: {
        taskId: "a",
        status: "completed",
        finalText: "done",
        rounds: 1,
        toolCallCount: 0
      },
      worktreePath: null
    });
    assert.equal(ctx.tasks[0]?.status, "completed");
    assert.equal(ctx.finalText, "done");
  });
});
