import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveNextRepoName,
  validateDependsOn
} from "./workspaceMemberUpdate.js";

describe("workspaceMemberUpdate extras", () => {
  it("resolveNextRepoName keeps current name when patch omitted", async () => {
    const member = {
      workspaceId: "ws1",
      projectId: "p1",
      repoName: "api",
      sortOrder: 0,
      dependsOn: [] as string[],
      env: {},
      createdAt: new Date()
    };
    const name = await resolveNextRepoName({
      workspaceRepo: {
        findMemberByRepoName: async () => null
      } as never,
      workspaceId: "ws1",
      member,
      patchRepoName: undefined
    });
    assert.equal(name, "api");
  });

  it("validateDependsOn rejects non-arrays", () => {
    assert.throws(
      () =>
        validateDependsOn({
          dependsOn: "api" as unknown as string[],
          memberNames: new Set(["api"])
        }),
      /must be an array/
    );
  });
});
