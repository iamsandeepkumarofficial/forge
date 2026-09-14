import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildRepoInventoryFromFacts,
  formatRepoInventoryBlock
} from "./repoInventory.js";
import type { RepoFacts } from "./repoFacts.js";

function facts(partial: Partial<RepoFacts> = {}): RepoFacts {
  return {
    rootPath: "/tmp/repo",
    analyzable: true,
    packageJsonPaths: [],
    packageManager: undefined,
    scripts: [],
    ecosystemEvidence: [],
    detectedStack: [],
    launchApps: [],
    launchReady: false,
    envKeysReferenced: [],
    envKeysFromSource: [],
    envExampleValues: {},
    hasPackageJson: false,
    suggestedSkills: [],
    ...partial
  };
}

describe("repoInventory", () => {
  it("buildRepoInventoryFromFacts aggregates skills and workspace flag", () => {
    const inv = buildRepoInventoryFromFacts({
      members: [
        {
          repo: "api",
          mountPath: "/workspace/api",
          facts: facts({ suggestedSkills: ["node-app"] })
        },
        {
          repo: "web",
          mountPath: "/workspace/web",
          facts: facts({ suggestedSkills: ["node-app", "react"] })
        }
      ],
      dependsOnGraph: [{ repo: "web", dependsOn: ["api"] }]
    });
    assert.equal(inv.isWorkspace, true);
    assert.deepEqual(inv.suggestedSkills, ["node-app", "react"]);
    assert.equal(inv.dependsOnGraph[0]!.dependsOn[0], "api");
  });

  it("formatRepoInventoryBlock renders analyzable and non-analyzable members", () => {
    const inv = buildRepoInventoryFromFacts({
      members: [
        {
          repo: "api",
          mountPath: "/workspace/api",
          facts: facts({
            packageJsonPaths: ["package.json"],
            packageManager: "pnpm",
            scripts: ["dev", "test"],
            detectedStack: ["express"],
            envKeysReferenced: ["DATABASE_URL", "JWT_SECRET"],
            hasPackageJson: true,
            suggestedSkills: ["node-app"]
          })
        },
        {
          repo: "missing",
          mountPath: "/workspace/missing",
          facts: facts({ analyzable: false })
        }
      ],
      dependsOnGraph: [
        { repo: "api", dependsOn: [] },
        { repo: "missing", dependsOn: ["api"] }
      ]
    });
    const block = formatRepoInventoryBlock(inv);
    assert.match(block, /## Workspace repos/);
    assert.match(block, /package manager: pnpm/);
    assert.match(block, /not analyzable/);
    assert.match(block, /Startup order/);
    assert.match(block, /Suggested skills/);
    assert.match(block, /DATABASE_URL/);
    assert.match(block, /Do not install database servers/);
  });

  it("treats a single nested member as workspace layout", () => {
    const inv = buildRepoInventoryFromFacts({
      members: [
        {
          repo: "solo",
          mountPath: "/workspace/solo",
          facts: facts({ packageJsonPaths: ["package.json"] })
        }
      ]
    });
    assert.equal(inv.isWorkspace, true);
    const block = formatRepoInventoryBlock(inv);
    assert.match(block, /`solo\/` → `\/workspace\/solo`/);
    assert.match(block, /session-root/);
    assert.doesNotMatch(block, /`solo\/` → `\/workspace`$/m);
  });

  it("formatRepoInventoryBlock notes missing launch for single repos", () => {
    const inv = buildRepoInventoryFromFacts({
      members: [
        {
          repo: "solo",
          mountPath: "/workspace",
          facts: facts({ packageJsonPaths: [] })
        }
      ]
    });
    assert.equal(inv.isWorkspace, false);
    const block = formatRepoInventoryBlock(inv);
    assert.match(block, /Repository inventory/);
    assert.match(block, /launch\.json.: missing/);
  });
});
