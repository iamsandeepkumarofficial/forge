import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionHealthReport } from "./sessionHealthTypes.js";

describe("sessionHealth", () => {
  it("SessionHealthReport shape is usable", () => {
    const sample: SessionHealthReport = {
      sessionId: "s",
      workspaceId: null,
      computedAt: new Date(0).toISOString(),
      overall: "ok",
      checks: [],
      launchReadiness: { ready: true, source: "none", apps: [] },
      runningApps: []
    };
    assert.equal(sample.overall, "ok");
  });
});
