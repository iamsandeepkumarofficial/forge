import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { hostFsAllowlistRoots } from "../projects/hostWorkspaceFs.js";
import type { SessionRepoInfo } from "../projects/sessionSandbox.js";
import { executeHostFsMutate } from "./sandboxHostFsMutate.js";

describe("sandboxHostFsMutate", () => {
  let tmp = "";

  afterEach(async () => {
    if (tmp) await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it("writes edits deletes and moves with before metadata", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-hmut-"));
    const info: SessionRepoInfo = {
      containerName: tmp,
      repoDir: "repo",
      workingDir: "/workspace",
      sessionRoot: "/workspace",
      hostWorkingDir: tmp
    };
    const roots = hostFsAllowlistRoots(info);
    const wrote = await executeHostFsMutate({
      info,
      roots,
      toolName: "write_file",
      args: { files: [{ path: "old.ts", content: "keep" }] }
    });
    assert.equal(wrote?.success, true);
    const edited = await executeHostFsMutate({
      info,
      roots,
      toolName: "edit_file",
      args: {
        files: [{ path: "old.ts", oldString: "keep", newString: "kept" }]
      }
    });
    assert.equal(edited?.success, true);
    assert.deepEqual(edited?.metadata?.files, [
      { path: "old.ts", op: "update", before: "keep" }
    ]);
    const moved = await executeHostFsMutate({
      info,
      roots,
      toolName: "move_files",
      args: { moves: [{ from: "old.ts", to: "new.ts" }] }
    });
    assert.equal(moved?.success, true);
    const deleted = await executeHostFsMutate({
      info,
      roots,
      toolName: "delete_files",
      args: { paths: ["new.ts"] }
    });
    assert.equal(deleted?.success, true);
    assert.equal(
      await executeHostFsMutate({
        info,
        roots,
        toolName: "read_file",
        args: { path: "new.ts" }
      }),
      null
    );
  });
});
