import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";

describe("getWorkspaceHealth tool", () => {
  let executeGetWorkspaceHealth: (options: {
    sessionId: string;
    args: Record<string, unknown>;
  }) => Promise<{ success: boolean; output: string }>;

  before(async () => {
    mock.module("../services/workspace/sessionHealth.js", {
      exports: {
        getSessionHealthReport: async () => ({
          overall: "ok",
          workspaceId: null,
          checks: [],
          runningApps: [],
          launchReadiness: { ready: true }
        }),
        formatSessionHealthForAgent: async () => "Session health (ok)"
      }
    });
    mock.module("../services/workspace/sessionHealthFormat.js", {
      exports: {
        formatSessionHealthForAgent: async () => "Session health (ok)"
      }
    });
    ({ executeGetWorkspaceHealth } =
      await import("./getWorkspaceHealth.tool.js"));
  });

  it("returns agent-formatted health on success", async () => {
    const result = await executeGetWorkspaceHealth({
      sessionId: "s1",
      args: {}
    });
    assert.equal(result.success, true);
    assert.match(result.output, /Session health/);
  });
});
