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
});
