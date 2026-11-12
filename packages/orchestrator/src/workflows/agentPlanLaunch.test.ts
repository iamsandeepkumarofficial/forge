import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  handleEmptyInFlight,
  launchReadyTasks,
  serializeAgentStarts
} from "./agentPlanLaunch.js";
import type { PlanRunContext } from "./agentPlanTypes.js";

describe("agentPlanLaunch", () => {
  it("exports launch helpers", () => {
    assert.equal(typeof launchReadyTasks, "function");
    assert.equal(typeof handleEmptyInFlight, "function");
  });

  it("continues when waiting tasks remain and nothing is in flight", async () => {
    const action = await handleEmptyInFlight({
      ctx: { inFlight: new Map(), planStatus: "running" } as never,
      buckets: {
        completed: new Set(),
        failed: [],
        waiting: [{ id: "h" }],
        pending: []
      } as never,
      readyCount: 0
    });
    assert.equal(action, "continue");
  });

  it("serializes inline agents but allows parallel child agents", () => {
    const ctx = {
      inFlight: new Map(),
      forceChildIsolation: false,
      tasks: [
        { id: "i1", executor: "agent", isolation: "inline" },
        { id: "i2", executor: "agent", isolation: "inline" },
        { id: "c1", executor: "agent", isolation: "child" },
        { id: "c2", executor: "agent", isolation: "child" },
        { id: "t1", executor: "tool" }
      ]
    } as unknown as PlanRunContext;
    assert.deepEqual(
      serializeAgentStarts({
        ctx,
        toStart: ["i1", "i2", "c1", "c2", "t1"]
      }),
      ["i1", "c1", "c2", "t1"]
    );

    ctx.inFlight.set("i1", {
      taskId: "i1",
      worktreePath: null,
      resultPromise: Promise.resolve({
        taskId: "i1",
        result: { kind: "failed", error: "x" },
        worktreePath: null
      })
    });
    assert.deepEqual(
      serializeAgentStarts({ ctx, toStart: ["i2", "c1", "t1"] }),
      ["c1", "t1"]
    );
  });

  it("treats unspecified agents as child when forceChildIsolation", () => {
    const ctx = {
      inFlight: new Map(),
      forceChildIsolation: true,
      tasks: [
        { id: "a1", executor: "agent" },
        { id: "a2", executor: "agent" },
        { id: "t1", executor: "tool" }
      ]
    } as unknown as PlanRunContext;
    assert.deepEqual(
      serializeAgentStarts({ ctx, toStart: ["a1", "a2", "t1"] }),
      ["a1", "a2", "t1"]
    );
  });
});
