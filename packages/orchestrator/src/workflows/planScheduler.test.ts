import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scheduleReadyTasks } from "./planScheduler.js";

describe("scheduleReadyTasks", () => {
  it("starts only tasks with satisfied deps", () => {
    const d = scheduleReadyTasks({
      tasks: [
        { id: "a", status: "pending", dependencies: [] },
        { id: "b", status: "pending", dependencies: ["a"] }
      ],
      completed: new Set(),
      runningCount: 0,
      instanceRunningCount: 0
    });
    assert.deepEqual(d.toStart, ["a"]);
    assert.deepEqual(d.blocked, ["b"]);
  });

  it("respects per-run cap of 4", () => {
    const tasks = ["a", "b", "c", "d", "e"].map((id) => ({
      id,
      status: "pending",
      dependencies: [] as string[]
    }));
    const d = scheduleReadyTasks({
      tasks,
      completed: new Set(),
      runningCount: 0,
      instanceRunningCount: 0,
      maxPerRun: 4
    });
    assert.equal(d.toStart.length, 4);
    assert.equal(d.pendingExtra.length, 1);
  });

  it("respects instance cap of 10", () => {
    const tasks = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`,
      status: "pending",
      dependencies: [] as string[]
    }));
    const d = scheduleReadyTasks({
      tasks,
      completed: new Set(),
      runningCount: 0,
      instanceRunningCount: 9,
      maxPerRun: 4,
      maxPerInstance: 10
    });
    assert.equal(d.toStart.length, 1);
  });
});
