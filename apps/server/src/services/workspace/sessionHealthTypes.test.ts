import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionHealthReport } from "./sessionHealthTypes.js";

describe("sessionHealthTypes", () => {
  it("exports report fields", () => {
    const report: SessionHealthReport = {
      sessionId: "s",
      workspaceId: null,
      computedAt: "t",
      overall: "ok",
      checks: [],
      launchReadiness: { ready: true, source: "none", apps: [] },
      runningApps: []
    };
    assert.equal(report.sessionId, "s");
  });
});
