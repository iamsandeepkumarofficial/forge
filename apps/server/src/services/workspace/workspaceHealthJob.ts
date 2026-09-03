import { WorkspaceHealthRepository } from "../../catalog/workspaceHealthRepository.js";
import { analyzeWorkspaceHealth } from "./health/analyzeWorkspaceHealth.js";
import type { WorkspacePrepareReport } from "./health/types.js";
import { emitSetupPrepareEval } from "../eval/phoenix.js";

const healthRepo = new WorkspaceHealthRepository();

/** Fire-and-forget workspace health recompute (no sandbox/install). Never throws. */
export function scheduleWorkspaceHealthAnalysis(workspaceId: string): void {
  void runWorkspaceHealthAnalysis(workspaceId).catch((err) => {
    console.warn(
      `[workspaceHealth] ${workspaceId}: ${err instanceof Error ? err.message : String(err)}`
    );
  });
}

export async function runWorkspaceHealthAnalysis(
  workspaceId: string
): Promise<void> {
  await healthRepo.setComputing(workspaceId);
  const report = await analyzeWorkspaceHealth(workspaceId);
  await healthRepo.saveReport(workspaceId, report.status, report);
}

/**
 * Analyze = evidence / shadows only.
 * Does not seed params, provision DBs, or install deps.
 */
export async function runWorkspaceAnalyzeAndPrepare(
  workspaceId: string,
  _userId: string
): Promise<void> {
  await healthRepo.setComputing(workspaceId);
  const report = await analyzeWorkspaceHealth(workspaceId);
  const prepare: WorkspacePrepareReport = {
    parametersSeeded: [],
    databases: {},
    installs: [],
    errors: [],
    shadows: report.shadows
  };
  report.prepare = prepare;
  await healthRepo.saveReport(workspaceId, report.status, report);
  void emitSetupPrepareEval({
    workspaceId,
    shadows: report.shadows,
    status: report.status,
    findingCodes: report.findings.map((f) => f.code)
  }).catch(() => undefined);
}
