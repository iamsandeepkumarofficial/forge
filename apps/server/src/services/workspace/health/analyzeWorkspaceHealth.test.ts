import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPrepareShadows } from "./analyzeWorkspaceHealth.js";
import type { RepoFacts } from "../../../projects/repoFacts.js";
import {
  DEFAULT_SANDBOX_IMAGE,
  GENERIC_SANDBOX_IMAGE
} from "../../../projects/sessionSandbox/constants.js";

function facts(partial: Partial<RepoFacts> = {}): RepoFacts {
  return {
    rootPath: "/tmp",
    analyzable: true,
    hasPackageJson: true,
    packageJsonPaths: ["package.json"],
    scripts: ["dev"],
    launchApps: [],
    launchReady: true,
    detectedStack: ["express"],
    suggestedSkills: [],
    envKeysFromSource: ["DATABASE_URL", "JWT_SECRET"],
    envKeysReferenced: ["DATABASE_URL", "JWT_SECRET", "HOST"],
    envExampleValues: { JWT_SECRET: "changeme", PUBLIC_URL: "http://x" },
    ecosystemEvidence: [
      {
        ecosystem: "node",
        manifests: ["package.json"],
        lockfiles: [],
        packageManagerGuess: "pnpm"
      }
    ],
    ...partial
  };
}

describe("buildPrepareShadows", () => {
  it("collects param candidates skipping filled and runtime keys", () => {
    const prev = process.env.FORGE_SANDBOX_IMAGE;
    delete process.env.FORGE_SANDBOX_IMAGE;
    const shadows = buildPrepareShadows({
      members: [
        { repo: "api", facts: facts() },
        {
          repo: "web",
          facts: facts({
            envKeysReferenced: ["JWT_SECRET", "PUBLIC_URL"],
            ecosystemEvidence: []
          })
        }
      ],
      filledKeys: new Set(["DATABASE_URL"])
    });
    assert.deepEqual(shadows.paramCandidates.map((p) => p.key).sort(), [
      "JWT_SECRET",
      "PUBLIC_URL"
    ]);
    const jwt = shadows.paramCandidates.find((p) => p.key === "JWT_SECRET");
    assert.equal(jwt?.secretLikely, true);
    assert.equal(jwt?.exampleHint, "(secret)");
    assert.ok(shadows.infraEvidence.includes("postgres"));
    assert.equal(shadows.preferredSandboxImage, DEFAULT_SANDBOX_IMAGE);
    if (prev !== undefined) process.env.FORGE_SANDBOX_IMAGE = prev;
  });

  it("prefers generic sandbox when no node evidence", () => {
    const prev = process.env.FORGE_SANDBOX_IMAGE;
    delete process.env.FORGE_SANDBOX_IMAGE;
    const shadows = buildPrepareShadows({
      members: [
        {
          repo: "py",
          facts: facts({
            ecosystemEvidence: [
              {
                ecosystem: "python",
                manifests: ["requirements.txt"],
                lockfiles: []
              }
            ],
            envKeysReferenced: [],
            detectedStack: ["flask"]
          })
        }
      ],
      filledKeys: new Set()
    });
    assert.equal(shadows.preferredSandboxImage, GENERIC_SANDBOX_IMAGE);
    if (prev !== undefined) process.env.FORGE_SANDBOX_IMAGE = prev;
  });

  it("skips non-analyzable members", () => {
    const shadows = buildPrepareShadows({
      members: [
        {
          repo: "ghost",
          facts: facts({ analyzable: false, envKeysReferenced: ["X"] })
        }
      ],
      filledKeys: new Set()
    });
    assert.deepEqual(shadows.paramCandidates, []);
  });
});
