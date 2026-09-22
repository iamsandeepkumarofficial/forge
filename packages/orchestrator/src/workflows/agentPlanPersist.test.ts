import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { snapshotFromCtx, budgetStopReason } from "./agentPlanPersist.js";
import { draftToTasks } from "./agentWorkflowModel.js";
import type { PlanPersistCtx } from "./agentPlanPersist.js";

function fakeCtx(): PlanPersistCtx {
  return {
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
    version: 1,
    replanCount: 0,
    tasks: draftToTasks({
      goal: "Ship",
      tasks: [
        { id: "a", description: "Do it", executor: "agent", dependencies: [] }
      ]
    }),
    workingMs: 0,
    llmTokens: 0,
    costUsd: 0,
    queuedFollowUp: null,
    short: {} as PlanPersistCtx["short"]
  };
}

describe("agentPlanPersist", () => {
  it("builds a snapshot from context", () => {
    const snap = snapshotFromCtx({ ctx: fakeCtx(), status: "planned" });
    assert.equal(snap.id, "p1");
    assert.equal(snap.status, "planned");
    assert.equal(snap.tasks[0]?.id, "a");
  });

  it("does not stop when usage is under budget", () => {
    assert.equal(budgetStopReason(fakeCtx()), null);
  });
});
