import type { SessionHealthReport } from "../../lib/tool-runner.js";

export function buildHealthFixPrompt(report: SessionHealthReport): string {
  const gaps = report.checks.filter((c) => c.status !== "ok");
  const lines = [
    "Fix the workspace health gaps below so the app can run and preview.",
    "Call `get_workspace_health` first, then `invoke_skill` workspace-readiness and the matching stack skills.",
    "Do not invent package-manager install matrices — follow the skills. Ask before installing host tools or infra.",
    "",
    `Overall: ${report.overall}`
  ];
  for (const c of gaps) {
    lines.push(`- [${c.status}] ${c.label}: ${c.summary.split("\n")[0]}`);
    for (const item of c.items ?? []) {
      if (item.status === "ok") continue;
      lines.push(
        `  - [${item.status}] ${item.label}${item.summary ? `: ${item.summary}` : ""}`
      );
    }
    if (c.remediation) lines.push(`  next: ${c.remediation}`);
  }
  return lines.join("\n");
}

export function healthHasGaps(report: SessionHealthReport | null): boolean {
  if (!report) return false;
  return report.overall === "warn" || report.overall === "fail";
}
