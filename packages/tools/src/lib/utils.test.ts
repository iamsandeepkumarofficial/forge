import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { resolveSessionWorkspacePath } from "./utils.js";

describe("resolveSessionWorkspacePath", () => {
  it("resolves a relative path under cwd", async () => {
    const cwd = path.join(path.sep, "tmp", "session");
    const result = await resolveSessionWorkspacePath(cwd, "repo/file.ts");
    assert.equal(result.absPath, path.resolve(cwd, "repo/file.ts"));
    assert.equal(result.displayPath, "repo/file.ts");
  });

  it("uses the absolute path as displayPath when relativePath is empty", async () => {
    const cwd = path.join(path.sep, "tmp", "session");
    const result = await resolveSessionWorkspacePath(cwd, "");
    assert.equal(result.absPath, path.resolve(cwd));
    assert.equal(result.displayPath, path.resolve(cwd));
  });

  it("normalizes parent-segment relative paths", async () => {
    const cwd = path.join(path.sep, "tmp", "session", "repo");
    const result = await resolveSessionWorkspacePath(cwd, "../outside.txt");
    assert.equal(result.absPath, path.resolve(cwd, "../outside.txt"));
    assert.equal(result.displayPath, "../outside.txt");
  });
});
