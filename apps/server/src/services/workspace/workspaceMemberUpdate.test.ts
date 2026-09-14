import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertNoDependsCycle,
  buildProposedDependsGraph,
  validateDependsOn
} from "./workspaceMemberUpdate.js";

describe("workspaceMemberUpdate", () => {
  it("validateDependsOn drops blanks and rejects unknown names", () => {
    const names = new Set(["api", "web"]);
    assert.deepEqual(
      validateDependsOn({
        dependsOn: ["api", " ", "web", "api"],
        memberNames: names
      }),
      ["api", "web"]
    );
    assert.throws(
      () =>
        validateDependsOn({
          dependsOn: ["missing"],
          memberNames: names
        }),
      /not a member/
    );
    assert.throws(
      () =>
        validateDependsOn({
          dependsOn: ["api"],
          memberNames: names,
          selfName: "api"
        }),
      /cannot dependOn itself/
    );
  });

  it("buildProposedDependsGraph rewrites renamed dependsOn edges", () => {
    const members = [
      {
        workspaceId: "ws1",
        projectId: "p1",
        repoName: "api",
        sortOrder: 0,
        dependsOn: [] as string[],
        env: {},
        createdAt: new Date()
      },
      {
        workspaceId: "ws1",
        projectId: "p2",
        repoName: "web",
        sortOrder: 1,
        dependsOn: ["api"],
        env: {},
        createdAt: new Date()
      }
    ];
    const proposed = buildProposedDependsGraph({
      members,
      projectId: "p1",
      member: members[0]!,
      nextRepoName: "backend",
      nextDependsOn: []
    });
    assert.deepEqual(proposed, [
      { repoName: "backend", dependsOn: [] },
      { repoName: "web", dependsOn: ["backend"] }
    ]);
  });

  it("assertNoDependsCycle rejects cycles", () => {
    assert.throws(
      () =>
        assertNoDependsCycle([
          { repoName: "a", dependsOn: ["b"] },
          { repoName: "b", dependsOn: ["a"] }
        ]),
      /dependsOn cycle/
    );
    assert.doesNotThrow(() =>
      assertNoDependsCycle([
        { repoName: "a", dependsOn: [] },
        { repoName: "b", dependsOn: ["a"] }
      ])
    );
  });
});
