import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { syncHostWorkingTree } from "./sessionWorkspaceClone.js";

describe("sessionWorkspaceClone", () => {
  it("copy-on-write copies install dirs, skips session identity, and deletes dest-only files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-clone-"));
    try {
      const from = path.join(root, "from");
      const to = path.join(root, "to");
      await fs.mkdir(path.join(from, "src"), { recursive: true });
      await fs.mkdir(path.join(from, "node_modules", "x"), { recursive: true });
      await fs.mkdir(path.join(from, ".next", "cache"), { recursive: true });
      await fs.mkdir(path.join(from, ".forge-runtime"), { recursive: true });
      await fs.writeFile(path.join(from, "src", "app.ts"), "parent", "utf8");
      await fs.writeFile(path.join(from, ".git"), "parent-gitdir", "utf8");
      await fs.writeFile(
        path.join(from, "node_modules", "x", "index.js"),
        "dep",
        "utf8"
      );
      await fs.writeFile(
        path.join(from, ".next", "cache", "chunk"),
        "build",
        "utf8"
      );
      await fs.writeFile(
        path.join(from, ".forge-runtime", "pid"),
        "parent-runtime",
        "utf8"
      );
      await fs.mkdir(path.join(to, "src"), { recursive: true });
      await fs.mkdir(path.join(to, "node_modules", "stale"), {
        recursive: true
      });
      await fs.mkdir(path.join(to, ".forge-runtime"), { recursive: true });
      await fs.writeFile(path.join(to, "src", "app.ts"), "canonical", "utf8");
      await fs.writeFile(path.join(to, "src", "extra.ts"), "stale", "utf8");
      await fs.writeFile(path.join(to, ".git"), "child-gitdir", "utf8");
      await fs.writeFile(
        path.join(to, "node_modules", "stale", "old.js"),
        "gone",
        "utf8"
      );
      await fs.writeFile(
        path.join(to, ".forge-runtime", "pid"),
        "child-runtime",
        "utf8"
      );
      await syncHostWorkingTree(from, to);
      assert.equal(
        await fs.readFile(path.join(to, "src", "app.ts"), "utf8"),
        "parent"
      );
      assert.equal(
        await fs.readFile(
          path.join(to, "node_modules", "x", "index.js"),
          "utf8"
        ),
        "dep"
      );
      assert.equal(
        await fs.readFile(path.join(to, ".next", "cache", "chunk"), "utf8"),
        "build"
      );
      await assert.rejects(fs.stat(path.join(to, "src", "extra.ts")), /ENOENT/);
      await assert.rejects(
        fs.stat(path.join(to, "node_modules", "stale", "old.js")),
        /ENOENT/
      );
      assert.equal(
        await fs.readFile(path.join(to, ".git"), "utf8"),
        "child-gitdir"
      );
      assert.equal(
        await fs.readFile(path.join(to, ".forge-runtime", "pid"), "utf8"),
        "child-runtime"
      );
      await fs.writeFile(
        path.join(to, "node_modules", "x", "index.js"),
        "child-dep",
        "utf8"
      );
      assert.equal(
        await fs.readFile(
          path.join(from, "node_modules", "x", "index.js"),
          "utf8"
        ),
        "dep"
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("preserves in-tree symlinks", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-clone-link-"));
    try {
      const from = path.join(root, "from");
      const to = path.join(root, "to");
      await fs.mkdir(path.join(from, "node_modules", ".pnpm", "pkg"), {
        recursive: true
      });
      await fs.mkdir(to, { recursive: true });
      await fs.writeFile(
        path.join(from, "node_modules", ".pnpm", "pkg", "index.js"),
        "pkg",
        "utf8"
      );
      await fs.symlink(".pnpm/pkg", path.join(from, "node_modules", "pkg"));
      await syncHostWorkingTree(from, to);
      const destLink = path.join(to, "node_modules", "pkg");
      assert.equal(await fs.readlink(destLink), ".pnpm/pkg");
      assert.equal(
        await fs.readFile(
          path.join(to, "node_modules", ".pnpm", "pkg", "index.js"),
          "utf8"
        ),
        "pkg"
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("materializes out-of-tree directory symlinks so the child is isolated", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-clone-out-"));
    try {
      const from = path.join(root, "from");
      const to = path.join(root, "to");
      const cache = path.join(root, "cache", "node_modules", "x");
      await fs.mkdir(from, { recursive: true });
      await fs.mkdir(to, { recursive: true });
      await fs.mkdir(cache, { recursive: true });
      await fs.writeFile(path.join(cache, "index.js"), "shared", "utf8");
      await fs.symlink(
        path.join(root, "cache", "node_modules"),
        path.join(from, "node_modules")
      );
      await syncHostWorkingTree(from, to);
      const destNm = path.join(to, "node_modules");
      const destSt = await fs.lstat(destNm);
      assert.equal(destSt.isSymbolicLink(), false);
      assert.equal(
        await fs.readFile(path.join(destNm, "x", "index.js"), "utf8"),
        "shared"
      );
      await fs.writeFile(path.join(destNm, "x", "index.js"), "child", "utf8");
      assert.equal(
        await fs.readFile(path.join(cache, "index.js"), "utf8"),
        "shared"
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("does not write through a dest install-dir symlink", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-clone-dest-"));
    try {
      const from = path.join(root, "from");
      const to = path.join(root, "to");
      const destCache = path.join(root, "dest-cache", "x");
      await fs.mkdir(path.join(from, "node_modules", "x"), { recursive: true });
      await fs.mkdir(to, { recursive: true });
      await fs.mkdir(destCache, { recursive: true });
      await fs.writeFile(
        path.join(from, "node_modules", "x", "index.js"),
        "parent",
        "utf8"
      );
      await fs.writeFile(
        path.join(destCache, "index.js"),
        "dest-cache",
        "utf8"
      );
      await fs.symlink(
        path.join(root, "dest-cache"),
        path.join(to, "node_modules")
      );
      await syncHostWorkingTree(from, to);
      const destNm = path.join(to, "node_modules");
      assert.equal((await fs.lstat(destNm)).isSymbolicLink(), false);
      assert.equal(
        await fs.readFile(path.join(destNm, "x", "index.js"), "utf8"),
        "parent"
      );
      assert.equal(
        await fs.readFile(path.join(destCache, "index.js"), "utf8"),
        "dest-cache"
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
