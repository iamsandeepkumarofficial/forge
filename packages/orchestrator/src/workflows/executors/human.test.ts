import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HumanExecutor } from "./human.js";
import { draftToTasks } from "../agentWorkflowModel.js";

describe("HumanExecutor", () => {
  it("waits on execute and completes on approve", async () => {
    const human = new HumanExecutor();
    const task = draftToTasks({
      goal: "g",
      tasks: [{ id: "h", description: "OK?", executor: "human" }]
    })[0]!;
    const context = {
      workflowId: "w",
      sessionId: "s",
      turnId: "t",
      planId: "p",
      taskId: "h"
    };
    assert.equal((await human.execute({ task, context })).kind, "waiting");
    assert.equal(
      (
        await human.resume({
          task,
          context,
          payload: { decision: "approve" }
        })
      ).kind,
      "completed"
    );
  });
});
