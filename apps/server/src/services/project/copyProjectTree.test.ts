import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { copyProjectTree } from "./copyProjectTree.js";

describe("copyProjectTree", () => {
  it("preserves .git and skips node_modules", async () => {
    const src = await fs.mkdtemp(path.join(os.tmpdir(), "forge-copy-src-"));
    const dest = await fs.mkdtemp(path.join(os.tmpdir(), "forge-copy-dst-"));
    try {
      await fs.mkdir(path.join(src, ".git"), { recursive: true });
      await fs.writeFile(path.join(src, ".git", "HEAD"), "ref: refs/heads/main\n");
      await fs.mkdir(path.join(src, "node_modules", "pkg"), { recursive: true });
      await fs.writeFile(
        path.join(src, "node_modules", "pkg", "index.js"),
        "module.exports = 1\n"
      );
      await fs.writeFile(path.join(src, "index.js"), "console.log('ok')\n");
      await fs.mkdir(path.join(src, ".next"), { recursive: true });
      await fs.writeFile(path.join(src, ".next", "cache"), "x\n");

      await copyProjectTree(src, dest);

      await fs.access(path.join(dest, ".git", "HEAD"));
      await fs.access(path.join(dest, "index.js"));
      await assert.rejects(() =>
        fs.access(path.join(dest, "node_modules", "pkg", "index.js"))
      );
      await assert.rejects(() => fs.access(path.join(dest, ".next", "cache")));
    } finally {
      await fs.rm(src, { recursive: true, force: true });
      await fs.rm(dest, { recursive: true, force: true });
    }
  });
});
