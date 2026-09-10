import { describe, it, expect } from "vitest";
import { buildHealthFixPrompt, healthHasGaps } from "./health-format";
import type { SessionHealthReport } from "../../lib/tool-runner.js";

const sample: SessionHealthReport = {
  sessionId: "s1",
  workspaceId: "w1",
  computedAt: new Date().toISOString(),
  overall: "warn",
  checks: [
    {
      id: "external-deps",
      label: "External dependencies",
      status: "warn",
      summary: "1 gap(s)",
      items: [
        {
          id: "infra:postgres",
          status: "warn",
          label: "PostgreSQL 16",
          summary: "needed — setup_project_infra"
        }
      ],
      remediation: "setup_project_infra"
    },
    {
      id: "launch-config",
      label: "Launch config",
      status: "ok",
      summary: "ready"
    }
  ],
  runningApps: []
};

describe("health-format", () => {
  it("healthHasGaps detects warn/fail", () => {
    expect(healthHasGaps(sample)).toBe(true);
    expect(healthHasGaps({ ...sample, overall: "ok" })).toBe(false);
  });

  it("buildHealthFixPrompt includes failing sub-items", () => {
    const prompt = buildHealthFixPrompt(sample);
    expect(prompt).toMatch(/get_workspace_health/);
    expect(prompt).toMatch(/PostgreSQL 16/);
    expect(prompt).toMatch(/External dependencies/);
    expect(prompt).not.toMatch(/Launch config/);
  });
});
