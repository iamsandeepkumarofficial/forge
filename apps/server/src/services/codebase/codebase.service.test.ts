import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  resolveManagedRoot,
  listMainManagedRepoRoots,
  ghRepoCloneIntoManagedRoot
} from "./codebase.service.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("codebase.service", () => {
  const prev = process.env.CODEBASE_ROOT;

  afterEach(() => {
    if (prev === undefined) delete process.env.CODEBASE_ROOT;
    else process.env.CODEBASE_ROOT = prev;
  });

  it("resolveManagedRoot uses CODEBASE_ROOT when absolute", () => {
    process.env.CODEBASE_ROOT = "/tmp/forge-repos-test";
    assert.equal(resolveManagedRoot(), "/tmp/forge-repos-test");
  });

  it("resolveManagedRoot expands ~ paths", () => {
    process.env.CODEBASE_ROOT = "~/forge-test-root";
    assert.equal(
      resolveManagedRoot(),
      path.join(os.homedir(), "forge-test-root")
    );
  });

  it("listMainManagedRepoRoots skips missing roots and non-git dirs", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-managed-"));
    try {
      await fs.mkdir(path.join(root, "plain"));
      await fs.mkdir(path.join(root, ".hidden"));
      await fs.mkdir(path.join(root, "with-git", ".git"), { recursive: true });
      const listed = await listMainManagedRepoRoots(root);
      assert.deepEqual(listed, [path.resolve(root, "with-git")]);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("ghRepoCloneIntoManagedRoot rejects invalid slugs", async () => {
    await assert.rejects(
      () => ghRepoCloneIntoManagedRoot("not-valid"),
      /Invalid GitHub slug/
    );
  });
});
