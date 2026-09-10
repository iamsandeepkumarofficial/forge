import { describe, it, expect, vi } from "vitest";
import { healthHasGaps } from "./health-format.js";
import { requestHealthFix } from "./health-panel.js";
import type { SessionHealthReport } from "../../lib/tool-runner.js";

vi.mock("./preview-comment-bus.js", () => ({
  postAgentPrompt: vi.fn()
}));

import { postAgentPrompt } from "./preview-comment-bus.js";

describe("health-panel", () => {
  it("requestHealthFix posts a Fix prompt", () => {
    const report: SessionHealthReport = {
      sessionId: "s1",
      workspaceId: null,
      computedAt: "t",
      overall: "warn",
      checks: [
        {
          id: "launch-config",
          label: "Launch config",
          status: "warn",
          summary: "missing"
        }
      ],
      runningApps: []
    };
    expect(healthHasGaps(report)).toBe(true);
    requestHealthFix({ report });
    expect(postAgentPrompt).toHaveBeenCalled();
  });
});
