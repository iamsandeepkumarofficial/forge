import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { findRepoRoot } from "./repoRoot.js";

describe("findRepoRoot", () => {
  it("uses FORGE_REPO_ROOT when it is a directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-root-"));
    const found = findRepoRoot({ env: { FORGE_REPO_ROOT: dir }, cwd: tmpdir() });
    assert.equal(found, dir);
  });

  it("walks up from cwd to pnpm-workspace.yaml", () => {
    const root = mkdtempSync(join(tmpdir(), "forge-walk-"));
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
    const nested = join(root, "apps", "electron");
    mkdirSync(nested, { recursive: true });
    assert.equal(findRepoRoot({ cwd: nested, env: {} }), root);
  });

  it("throws when no root is found", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-empty-"));
    assert.throws(
      () => findRepoRoot({ cwd: dir, env: {}, startDirs: [dir] }),
      /FORGE_REPO_ROOT/
    );
  });
});
