import { listAppStatuses } from "../../projects/appRunner.js";
import type { WorkspaceHealthReport } from "./health/types.js";
import {
  analysisFindingsForChecklist,
  buildAnalysisItems,
  worstItemStatus,
  type SessionHealthCheckItem
} from "./sessionHealthChecks.js";
import type {
  SessionHealthCheck,
  SessionHealthReport
} from "./sessionHealthTypes.js";

const ANALYSIS_DETAIL_LIMIT = 8;

export async function buildRunningServicesCheck(sessionId: string): Promise<{
  runningApps: SessionHealthReport["runningApps"];
  runningCheck: SessionHealthCheck;
}> {
  try {
    const statuses = await listAppStatuses(sessionId);
    const runningApps = (statuses.apps ?? []).map((a) => ({
      name: a.name,
      running: Boolean(a.running),
      port: a.port ?? undefined,
      url: a.url ?? undefined
    }));
    const declared = runningApps.length;
    const up = runningApps.filter((a) => a.running).length;
    const items: SessionHealthCheckItem[] = runningApps.map((a) => ({
      id: `app:${a.name}`,
      status: a.running ? "ok" : "warn",
      label: a.name,
      summary: a.running
        ? `up${a.port != null ? ` :${a.port}` : ""}`
        : "not running"
    }));
    return {
      runningApps,
      runningCheck: {
        id: "running-services",
        label: "Internal services",
        status:
          declared === 0
            ? "warn"
            : up === declared
              ? "ok"
              : up === 0
                ? "fail"
                : "warn",
        summary:
          declared === 0
            ? "No apps declared in launch.json yet."
            : `${up}/${declared} declared apps running.`,
        detail: runningApps
          .map(
            (a) =>
              `${a.name}: ${a.running ? "up" : "down"}${a.port != null ? ` :${a.port}` : ""}`
          )
          .join("; "),
        remediation:
          declared === 0 || up < declared
            ? "Use preview_start for missing apps (after launch config is ready)."
            : undefined,
        items: items.length > 0 ? items : undefined
      }
    };
  } catch (err) {
    return {
      runningApps: [],
      runningCheck: {
        id: "running-services",
        label: "Internal services",
        status: "unknown",
        summary: "Could not read app status.",
        detail: err instanceof Error ? err.message : String(err)
      }
    };
  }
}

export function buildWorkspaceAnalysisCheck(
  report: WorkspaceHealthReport
): SessionHealthCheck | null {
  const findings = analysisFindingsForChecklist(report);
  if (findings.length === 0) return null;
  const items = buildAnalysisItems(findings);
  const status = worstItemStatus(items.map((i) => i.status));
  const blockers = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");
  return {
    id: "workspace-analysis",
    label: "Workspace analysis",
    status,
    summary:
      blockers.length > 0
        ? `${blockers.length} blocker(s) from last workspace analysis.`
        : `${warnings.length} warning(s) from last workspace analysis.`,
    detail: findings
      .slice(0, ANALYSIS_DETAIL_LIMIT)
      .map(
        (f) =>
          `${f.code}${f.repo ? ` (${f.repo})` : ""}: ${f.message}${f.hint ? ` — ${f.hint}` : ""}`
      )
      .join("\n"),
    remediation:
      blockers[0]?.hint ??
      warnings[0]?.hint ??
      "Review findings; invoke_skill workspace-readiness for gaps.",
    items
  };
}
