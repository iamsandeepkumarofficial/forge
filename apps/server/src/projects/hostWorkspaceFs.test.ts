import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  assertUnderAllowlist,
  deleteHostWorkspaceFile,
  hostFsAllowlistRoots,
  listHostWorkspaceDir,
  moveHostWorkspaceFile,
  readHostWorkspaceFile,
  resolveHostFsPath,
  searchHostWorkspace,
  writeHostWorkspaceFile
} from "./hostWorkspaceFs.js";
import type { SessionRepoInfo } from "./sessionSandbox.js";

describe("hostWorkspaceFs", () => {
  let tmp = "";

  afterEach(async () => {
    if (tmp) await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it("maps single-repo logical paths and rejects traversal", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-hfs-"));
    const info: SessionRepoInfo = {
      containerName: tmp,
      repoDir: "repo",
      workingDir: "/workspace",
      sessionRoot: "/workspace",
      hostWorkingDir: tmp
    };
    const abs = resolveHostFsPath({
      info,
      logicalAbsPath: "/workspace/src/a.ts"
    });
    assert.equal(abs, path.join(tmp, "src", "a.ts"));
    assert.throws(() =>
      resolveHostFsPath({ info, logicalAbsPath: "/workspace/../etc/passwd" })
    );
    assert.throws(() =>
      assertUnderAllowlist(
        path.join(tmp, "..", "outside"),
        hostFsAllowlistRoots(info)
      )
    );
  });

  it("maps multi-repo hostWorktrees", () => {
    const a = "/tmp/forge-a";
    const b = "/tmp/forge-b";
    const info: SessionRepoInfo = {
      containerName: a,
      repoDir: "frontend",
      workingDir: "/workspace",
      sessionRoot: "/workspace",
      worktrees: {
        frontend: "/workspace/frontend",
        backend: "/workspace/backend"
      },
      hostWorktrees: { frontend: a, backend: b }
    };
    assert.equal(
      resolveHostFsPath({
        info,
        logicalAbsPath: "/workspace/backend/x.ts"
      }),
      path.join(b, "x.ts")
    );
  });

  it("reads writes lists and searches under allowlist", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-hfs2-"));
    const roots = [tmp];
    const file = path.join(tmp, "hello.ts");
    await writeHostWorkspaceFile({
      absPath: file,
      content: "const x = 1;\nconst y = 2;\n",
      roots
    });
    assert.equal(
      await readHostWorkspaceFile(file, roots),
      "const x = 1;\nconst y = 2;\n"
    );
    const entries = await listHostWorkspaceDir({
      absPath: tmp,
      relPrefix: "",
      roots
    });
    assert.ok(entries.some((e) => e.name === "hello.ts"));
    const hits = await searchHostWorkspace({
      baseRoot: tmp,
      searchRoot: tmp,
      pattern: "const y",
      roots
    });
    assert.equal(hits.length, 1);
    assert.match(hits[0]!, /hello\.ts:2:/);
  });

  it("treats directory symlinks as directories", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-hfs-link-"));
    const real = path.join(tmp, "real-repo");
    await fs.mkdir(real);
    await fs.writeFile(path.join(real, "pkg.json"), "{}");
    const view = path.join(tmp, "view");
    await fs.mkdir(view);
    await fs.symlink(real, path.join(view, "frontend"), "dir");
    const entries = await listHostWorkspaceDir({
      absPath: view,
      relPrefix: "",
      roots: [view, real]
    });
    assert.deepEqual(
      entries.find((e) => e.name === "frontend"),
      { name: "frontend", path: "frontend", isDir: true }
    );
  });

  it("deletes and moves files but refuses directories", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-hfs-mv-"));
    const roots = [tmp];
    const src = path.join(tmp, "a.ts");
    const dest = path.join(tmp, "nested", "b.ts");
    await writeHostWorkspaceFile({ absPath: src, content: "keep", roots });
    await moveHostWorkspaceFile({ fromAbs: src, toAbs: dest, roots });
    assert.equal(await readHostWorkspaceFile(dest, roots), "keep");
    await deleteHostWorkspaceFile(dest, roots);
    assert.equal(await readHostWorkspaceFile(dest, roots), null);
    const dir = path.join(tmp, "folder");
    await fs.mkdir(dir);
    await assert.rejects(deleteHostWorkspaceFile(dir, roots), /Not a file/);
    await assert.rejects(
      moveHostWorkspaceFile({
        fromAbs: dir,
        toAbs: path.join(tmp, "other"),
        roots
      }),
      /Not a file/
    );
  });
});
