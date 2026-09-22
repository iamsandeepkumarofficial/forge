import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlanRunContext } from "./agentPlanTypes.js";

describe("agentPlanTypes", () => {
  it("describes a mutable plan run context", () => {
    const ctx = {
      planStatus: "running",
      inFlight: new Map(),
      cancelRequested: false
    } as Pick<PlanRunContext, "planStatus" | "inFlight" | "cancelRequested">;
    assert.equal(ctx.planStatus, "running");
    assert.equal(ctx.cancelRequested, false);
  });
});
