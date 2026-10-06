import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftToTasks,
  isMutatingMode,
  toSnapshot
} from "./agentWorkflowModel.js";

describe("agentWorkflowModel", () => {
  it("maps a draft onto pending tasks", () => {
    const tasks = draftToTasks({
      goal: "Ship auth",
      tasks: [
        {
          id: "inspect",
          description: "Read the repo",
          executor: "agent",
          dependencies: []
        }
      ]
    });
    assert.equal(tasks[0]?.status, "pending");
    assert.equal(tasks[0]?.idempotent, false);
  });

  it("treats plan and ask as non-mutating", () => {
    assert.equal(isMutatingMode("plan"), false);
    assert.equal(isMutatingMode("agent"), true);
  });

  it("copies task fields into a snapshot", () => {
    const snap = toSnapshot({
      planId: "p1",
      goal: "Ship auth",
      status: "planned",
      version: 1,
      replanCount: 0,
      tasks: draftToTasks({
        goal: "Ship auth",
        tasks: [
          {
            id: "inspect",
            description: "Read",
            executor: "agent"
          }
        ]
      })
    });
    assert.equal(snap.tasks[0]?.id, "inspect");
    assert.equal(snap.status, "planned");
  });
});
