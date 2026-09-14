import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveWorkspacePath } from "./sandboxExec.js";

describe("sandboxExec path helpers", () => {
  it("resolveWorkspacePath joins under /workspace", () => {
    assert.equal(
      resolveWorkspacePath("src/index.ts"),
      "/workspace/src/index.ts"
    );
    assert.equal(
      resolveWorkspacePath("/src/index.ts"),
      "/workspace/src/index.ts"
    );
    assert.equal(resolveWorkspacePath("a\\b\\c"), "/workspace/a/b/c");
    assert.equal(resolveWorkspacePath("./x"), "/workspace/x");
  });

  it("rejects path traversal", () => {
    assert.throws(
      () => resolveWorkspacePath("../etc/passwd"),
      /traversal outside the workspace/
    );
    assert.throws(
      () => resolveWorkspacePath("a/../../b"),
      /traversal outside the workspace/
    );
  });

  it("treats empty relative as workspace root", () => {
    assert.equal(resolveWorkspacePath(""), "/workspace/");
  });

  it("validates first segment against knownRepos when provided", () => {
    assert.equal(
      resolveWorkspacePath("frontend/src/a.ts", {
        knownRepos: ["frontend", "backend"]
      }),
      "/workspace/frontend/src/a.ts"
    );
    assert.throws(
      () =>
        resolveWorkspacePath("other/x", {
          knownRepos: ["frontend", "backend"]
        }),
      /member repo/
    );
  });

  it("strips a leading workspace/ mount prefix before member validation", () => {
    assert.equal(
      resolveWorkspacePath("/workspace/frontend/src/a.ts", {
        knownRepos: ["frontend", "backend"]
      }),
      "/workspace/frontend/src/a.ts"
    );
    assert.equal(
      resolveWorkspacePath("workspace/bp-frontend/package.json", {
        knownRepos: ["bp-frontend", "bp-backend"]
      }),
      "/workspace/bp-frontend/package.json"
    );
    assert.equal(resolveWorkspacePath("/workspace"), "/workspace/");
    assert.equal(resolveWorkspacePath("workspace"), "/workspace/");
  });
});
