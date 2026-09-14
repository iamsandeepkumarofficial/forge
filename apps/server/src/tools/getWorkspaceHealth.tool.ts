import { getSessionHealthReport } from "../services/workspace/sessionHealth.js";
import { formatSessionHealthForAgent } from "../services/workspace/sessionHealthFormat.js";

export async function executeGetWorkspaceHealth(options: {
  sessionId: string;
  args: Record<string, unknown>;
}): Promise<{
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}> {
  try {
    const report = await getSessionHealthReport(options.sessionId);
    const output = await formatSessionHealthForAgent(options.sessionId);
    return {
      success: true,
      output,
      metadata: {
        overall: report.overall,
        workspaceId: report.workspaceId,
        checks: report.checks,
        runningApps: report.runningApps,
        launchReady: report.launchReadiness.ready
      }
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      output: `get_workspace_health failed: ${message}`
    };
  }
}
