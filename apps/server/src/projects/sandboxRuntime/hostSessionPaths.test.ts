import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import {
  hostManagedSessionRoot,
  isUnderHostManagedRoot,
  sanitizeSessionFsName
} from "./hostSessionPaths.js";

describe("hostSessionPaths", () => {
  const prev = process.env.FORGE_SESSIONS_ROOT;

  it("builds managed root under _host", () => {
    process.env.FORGE_SESSIONS_ROOT = "/tmp/forge-sessions-test";
    try {
      assert.equal(sanitizeSessionFsName("workbench-1"), "workbench-1");
      const root = hostManagedSessionRoot("workbench-1");
      assert.equal(
        root,
        path.join("/tmp/forge-sessions-test", "_host", "workbench-1")
      );
      assert.equal(isUnderHostManagedRoot(root), true);
      assert.equal(
        isUnderHostManagedRoot("/tmp/forge-sessions-test/proj/sess"),
        false
      );
    } finally {
      if (prev === undefined) delete process.env.FORGE_SESSIONS_ROOT;
      else process.env.FORGE_SESSIONS_ROOT = prev;
    }
  });
});
