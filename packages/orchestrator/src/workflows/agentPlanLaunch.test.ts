import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleEmptyInFlight, launchReadyTasks } from "./agentPlanLaunch.js";

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
});
