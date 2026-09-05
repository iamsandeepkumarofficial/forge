import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  factsHaveNodeEvidence,
  factsHavePythonEvidence,
  suggestSkillsForFacts,
  type RepoFacts
} from "./repoFacts.js";

function baseFacts(overrides: Partial<RepoFacts> = {}): RepoFacts {
  return {
    rootPath: "/tmp",
    analyzable: true,
    hasPackageJson: true,
    packageJsonPaths: ["package.json"],
    packageManager: "pnpm",
    scripts: ["dev"],
    launchApps: [],
    launchReady: false,
    detectedStack: ["react"],
    suggestedSkills: [],
    envKeysFromSource: [],
    envKeysReferenced: [],
    envExampleValues: {},
    ecosystemEvidence: [
      { ecosystem: "node", manifests: ["package.json"], lockfiles: [] }
    ],
    ...overrides
  };
}

describe("repoFactsEcosystem", () => {
  it("detects node and python evidence", () => {
    assert.equal(factsHaveNodeEvidence(baseFacts()), true);
    assert.equal(
      factsHavePythonEvidence(
        baseFacts({
          ecosystemEvidence: [
            {
              ecosystem: "python",
              manifests: ["pyproject.toml"],
              lockfiles: []
            }
          ],
          detectedStack: ["fastapi"]
        })
      ),
      true
    );
  });

  it("suggests skills from stack signals", () => {
    const skills = suggestSkillsForFacts(
      baseFacts({
        detectedStack: ["next", "prisma"],
        envKeysReferenced: ["DATABASE_URL"]
      })
    );
    assert.ok(skills.includes("nextjs-app"));
    assert.ok(skills.includes("frontend-app"));
    assert.ok(skills.includes("db-migrations"));
  });
});
