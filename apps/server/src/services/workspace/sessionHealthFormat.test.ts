import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatSessionHealthReport } from "./sessionHealthFormat.js";
import type { SessionHealthReport } from "./sessionHealthTypes.js";

describe("sessionHealthFormat", () => {
  it("formats a minimal report", () => {
    const report: SessionHealthReport = {
      sessionId: "s",
      workspaceId: null,
      computedAt: "t0",
      overall: "ok",
      checks: [
        {
          id: "launch-config",
          label: "Launch config",
          status: "ok",
          summary: "ready"
        }
      ],
      launchReadiness: { ready: true, source: "none", apps: [] },
      runningApps: []
    };
    const text = formatSessionHealthReport(report);
    assert.match(text, /Session health \(ok\)/);
    assert.match(text, /Launch config/);
  });
});
