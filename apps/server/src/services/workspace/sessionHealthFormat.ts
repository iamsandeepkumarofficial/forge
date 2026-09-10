import { WorkspaceRepository } from "../../catalog/workspaceRepository.js";
import {
  getSessionHealthReport,
  type SessionHealthReport
} from "./sessionHealth.js";

export async function formatSessionHealthForAgent(
  sessionId: string
): Promise<string> {
  const report = await getSessionHealthReport(sessionId);
  return formatSessionHealthReport(report);
}

export function formatSessionHealthReport(report: SessionHealthReport): string {
  const lines = [
    `Session health (${report.overall}) @ ${report.computedAt}`,
    report.workspaceId
      ? `Workspace: ${report.workspaceId}`
      : "Single-repo session",
    ""
  ];
  for (const c of report.checks) {
    lines.push(`[${c.status}] ${c.label}: ${c.summary}`);
    if (c.items && c.items.length > 0) {
      for (const item of c.items) {
        lines.push(
          `  - [${item.status}] ${item.label}${item.summary ? `: ${item.summary}` : ""}`
        );
      }
    } else if (c.detail) {
      lines.push(`  detail: ${c.detail}`);
    }
    if (c.remediation) lines.push(`  next: ${c.remediation}`);
  }
  if (report.runningApps.length > 0) {
    lines.push("", "Apps:");
    for (const a of report.runningApps) {
      lines.push(
        `- ${a.name}: ${a.running ? "running" : "stopped"}${a.url ? ` ${a.url}` : ""}`
      );
    }
  }
  return lines.join("\n");
}

export async function listWorkspaceMemberNames(
  workspaceId: string
): Promise<string[]> {
  const repo = new WorkspaceRepository();
  const members = await repo.listMembers(workspaceId);
  return members.map((m) => m.repoName);
}
