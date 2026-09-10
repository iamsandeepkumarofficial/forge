import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  analysisFindingsForChecklist,
  buildAnalysisItems,
  buildInfraItems,
  buildInstallPendingItems,
  buildLiveMissingEnvItems,
  buildMissingEnvItems,
  buildRuntimeVersionItems,
  installMarkerMissing,
  requiredStackHostTools,
  stackFlagsFromMembers,
  worstItemStatus
} from "./sessionHealthChecks.js";
import type { HealthFinding, WorkspaceHealthReport } from "./health/types.js";

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "forge-health-"));
  tmpDirs.push(d);
  return d;
}

describe("sessionHealthChecks", () => {
  it("worstItemStatus prefers fail over warn", () => {
    assert.equal(worstItemStatus(["ok", "warn", "fail"]), "fail");
    assert.equal(worstItemStatus(["ok", "warn"]), "warn");
    assert.equal(worstItemStatus(["ok"]), "ok");
  });

  it("requiredStackHostTools defaults to node when no stack flags", () => {
    assert.deepEqual(
      requiredStackHostTools({
        hasNode: false,
        hasPython: false,
        hasGo: false
      }),
      ["git", "node"]
    );
  });

  it("requiredStackHostTools includes python3 when stack has python", () => {
    assert.deepEqual(
      requiredStackHostTools({ hasNode: true, hasPython: true, hasGo: false }),
      ["git", "node", "python3"]
    );
  });

  it("installMarkerMissing detects missing node_modules", () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    const gap = installMarkerMissing(root, [
      { ecosystem: "node", manifests: ["package.json"], lockfiles: [] }
    ]);
    assert.ok(gap?.includes("node_modules"));
    fs.mkdirSync(path.join(root, "node_modules"));
    assert.equal(
      installMarkerMissing(root, [
        { ecosystem: "node", manifests: ["package.json"], lockfiles: [] }
      ]),
      null
    );
  });

  it("buildInstallPendingItems warns when deps missing", () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    const items = buildInstallPendingItems({
      members: [
        {
          repo: "frontend",
          rootPath: root,
          ecosystemEvidence: [
            { ecosystem: "node", manifests: ["package.json"], lockfiles: [] }
          ],
          hasPackageJson: true
        }
      ]
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.status, "warn");
    assert.ok(items[0]?.summary?.includes("node_modules"));
  });

  it("buildInfraItems warns when postgres needed but not attached", () => {
    const items = buildInfraItems({
      members: [
        {
          repo: "api",
          envKeysReferenced: ["DATABASE_URL"],
          detectedStack: ["prisma"]
        }
      ],
      attachedEngines: new Set()
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, "infra:postgres");
    assert.equal(items[0]?.status, "warn");
    assert.ok(items[0]?.summary?.includes("setup_project_infra"));
  });

  it("buildInfraItems ok when engine attached", () => {
    const items = buildInfraItems({
      members: [
        {
          repo: "api",
          envKeysReferenced: ["DATABASE_URL"],
          detectedStack: []
        }
      ],
      attachedEngines: new Set(["postgres"])
    });
    assert.equal(items[0]?.status, "ok");
  });

  it("buildLiveMissingEnvItems lists unset keys", () => {
    const items = buildLiveMissingEnvItems({
      members: [
        {
          repo: "api",
          envKeysReferenced: ["DATABASE_URL", "JWT_SECRET", "HOST"]
        }
      ],
      availableKeys: new Set(["HOST", "PORT"])
    });
    const keys = items.map((i) => i.id).sort();
    assert.ok(keys.some((k) => k.includes("DATABASE_URL")));
    assert.ok(keys.some((k) => k.includes("JWT_SECRET")));
    assert.ok(!keys.some((k) => k.includes(":HOST")));
  });

  it("buildRuntimeVersionItems flags node mismatch", () => {
    const items = buildRuntimeVersionItems({
      members: [
        {
          repo: "web",
          runtimeRequirements: [
            {
              tool: "node",
              range: ">=18 <20",
              source: "package.json engines.node"
            }
          ]
        }
      ],
      available: { node: "20.11.1" }
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.status, "fail");
    assert.ok(items[0]?.summary?.includes("20.11.1"));
    assert.ok(items[0]?.summary?.includes(">=18 <20"));
  });

  it("buildMissingEnvItems maps analysis findings", () => {
    const findings: HealthFinding[] = [
      {
        code: "missing-env-key",
        severity: "warning",
        repo: "api",
        message: "Referenced env key `DATABASE_URL` is not set."
      }
    ];
    const items = buildMissingEnvItems(findings);
    assert.equal(items.length, 1);
    assert.ok(items[0]?.summary?.includes("DATABASE_URL"));
  });

  it("analysisFindingsForChecklist drops env/toolchain codes", () => {
    const report = {
      status: "warnings",
      computedAt: new Date().toISOString(),
      members: [],
      findings: [
        {
          code: "missing-env-key",
          severity: "warning",
          message: "env"
        },
        {
          code: "missing-dev-script",
          severity: "warning",
          repo: "web",
          message: "no script"
        }
      ] as HealthFinding[],
      dependsOnGraph: []
    } satisfies WorkspaceHealthReport;
    const filtered = analysisFindingsForChecklist(report);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.code, "missing-dev-script");
    const items = buildAnalysisItems(filtered);
    assert.equal(items[0]?.label, "missing-dev-script (web)");
  });

  it("stackFlagsFromMembers reads ecosystem evidence", () => {
    const flags = stackFlagsFromMembers([
      {
        ecosystemEvidence: [
          { ecosystem: "python", manifests: ["pyproject.toml"], lockfiles: [] }
        ]
      }
    ]);
    assert.equal(flags.hasPython, true);
    assert.equal(flags.hasNode, false);
  });
});
