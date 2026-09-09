import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inferWorkspaceRepo } from "./config.js";

describe("appRunner config", () => {
  it("inferWorkspaceRepo resolves from cwd and name prefixes", () => {
    assert.equal(
      inferWorkspaceRepo({
        app: { name: "web", cwd: "api/src", repo: undefined },
        memberRepos: ["api", "web"]
      }),
      "api"
    );
    assert.equal(
      inferWorkspaceRepo({
        app: { name: "web/app", cwd: ".", repo: undefined },
        memberRepos: ["api", "web"]
      }),
      "web"
    );
    assert.equal(
      inferWorkspaceRepo({
        app: { name: "x", cwd: ".", repo: "api" },
        memberRepos: ["api", "web"]
      }),
      "api"
    );
  });
});
