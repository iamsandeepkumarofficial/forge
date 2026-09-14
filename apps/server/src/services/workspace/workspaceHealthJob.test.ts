import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("workspaceHealthJob", () => {
  let runWorkspaceHealthAnalysis: typeof import("./workspaceHealthJob.js").runWorkspaceHealthAnalysis;
  let runWorkspaceAnalyzeAndPrepare: typeof import("./workspaceHealthJob.js").runWorkspaceAnalyzeAndPrepare;
  let scheduleWorkspaceHealthAnalysis: typeof import("./workspaceHealthJob.js").scheduleWorkspaceHealthAnalysis;

  const calls: {
    setComputing: string[];
    save: Array<{ id: string; status: string; report: unknown }>;
    analyze: string[];
    eval: unknown[];
  } = {
    setComputing: [],
    save: [],
    analyze: [],
    eval: []
  };

  before(async () => {
    mock.module("../../catalog/workspaceHealthRepository.js", {
      exports: {
        WorkspaceHealthRepository: class {
          async setComputing(id: string) {
            calls.setComputing.push(id);
          }
          async saveReport(options: {
            workspaceId: string;
            status: string;
            report: unknown;
          }) {
            calls.save.push({
              id: options.workspaceId,
              status: options.status,
              report: options.report
            });
          }
        }
      }
    });
    mock.module("./health/analyzeWorkspaceHealth.js", {
      exports: {
        analyzeWorkspaceHealth: async (id: string) => {
          calls.analyze.push(id);
          return {
            status: "warnings",
            computedAt: "2026-01-01T00:00:00.000Z",
            members: [],
            findings: [{ code: "missing-env-key", severity: "warning" }],
            dependsOnGraph: [],
            shadows: {
              ecosystemEvidence: [],
              paramCandidates: [],
              infraEvidence: [],
              preferredSandboxImage: "forge-sandbox-generic:latest"
            }
          };
        }
      }
    });
    mock.module("../eval/phoenix.js", {
      exports: {
        emitSetupPrepareEval: async (input: unknown) => {
          calls.eval.push(input);
        }
      }
    });
    ({
      runWorkspaceHealthAnalysis,
      runWorkspaceAnalyzeAndPrepare,
      scheduleWorkspaceHealthAnalysis
    } = await import("./workspaceHealthJob.js"));
  });

  it("runWorkspaceHealthAnalysis saves analyze report", async () => {
    calls.setComputing.length = 0;
    calls.save.length = 0;
    calls.analyze.length = 0;
    await runWorkspaceHealthAnalysis("ws1");
    assert.deepEqual(calls.setComputing, ["ws1"]);
    assert.deepEqual(calls.analyze, ["ws1"]);
    assert.equal(calls.save[0]!.status, "warnings");
  });

  it("runWorkspaceAnalyzeAndPrepare attaches empty prepare and emits eval", async () => {
    calls.save.length = 0;
    calls.eval.length = 0;
    await runWorkspaceAnalyzeAndPrepare("ws2", "u1");
    const report = calls.save[0]!.report as {
      prepare: { parametersSeeded: unknown[]; errors: unknown[] };
      status: string;
    };
    assert.deepEqual(report.prepare.parametersSeeded, []);
    assert.deepEqual(report.prepare.errors, []);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls.eval.length, 1);
  });

  it("scheduleWorkspaceHealthAnalysis fires without throwing", () => {
    scheduleWorkspaceHealthAnalysis("ws3");
  });
});
