import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWorkspaceAnalysisCheck } from "./sessionHealthRunning.js";
import type { WorkspaceHealthReport } from "./health/types.js";

describe("sessionHealthRunning", () => {
  it("buildWorkspaceAnalysisCheck returns null without findings", () => {
    const report = {
      status: "ready",
      findings: []
    } as unknown as WorkspaceHealthReport;
    assert.equal(buildWorkspaceAnalysisCheck(report), null);
  });
});
