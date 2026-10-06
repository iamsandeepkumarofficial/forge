import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPlanRunContext, runPlanExecutionLoop } from "./agentPlanLoop.js";
import { applyExecutionResult } from "./agentPlanLaunch.js";
import { draftToTasks } from "./agentWorkflowModel.js";
import { ExecutorRegistry, HumanExecutor } from "./executors/index.js";

describe("agentPlanLoop", () => {
  it("exports the plan loop helpers", () => {
    assert.equal(typeof runPlanExecutionLoop, "function");
    assert.equal(typeof applyExecutionResult, "function");
    assert.equal(typeof createPlanRunContext, "function");
  });

  it("applies a completed execution onto task state", async () => {
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
        mergeTaskWorktree: async () => ({ ok: true }),
        persistTask: async () => ({ task: null }),
        publishTaskUpdated: async () => undefined
      } as never,
      planner: {} as never,
      maxConcurrency: 2,
      registry: new ExecutorRegistry().register("human", new HumanExecutor())
    });
    await applyExecutionResult({
      ctx,
      taskId: "a",
      result: {
        kind: "completed",
        output: { finalText: "done", rounds: 1, toolCallCount: 0 }
      },
      worktreePath: null
    });
    assert.equal(ctx.tasks[0]?.status, "completed");
    assert.equal(ctx.finalText, "done");
  });
});
