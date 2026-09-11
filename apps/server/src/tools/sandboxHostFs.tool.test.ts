import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import type { SessionRepoInfo } from "../projects/sessionSandbox.js";
import { executeHostSandboxFsTool } from "./sandboxHostFs.tool.js";

describe("sandboxHostFs.tool", () => {
  let tmp = "";

  afterEach(async () => {
    if (tmp) await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it("reads and writes via host FS tools", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-sfs-"));
    const info: SessionRepoInfo = {
      containerName: tmp,
      repoDir: "repo",
      workingDir: "/workspace",
      sessionRoot: "/workspace",
      hostWorkingDir: tmp
    };
    const wrote = await executeHostSandboxFsTool({
      info,
      toolName: "write_file",
      args: { path: "a.txt", content: "hello" }
    });
    assert.equal(wrote?.success, true);
    const read = await executeHostSandboxFsTool({
      info,
      toolName: "read_file",
      args: { path: "a.txt" }
    });
    assert.equal(read?.success, true);
    assert.match(read?.output ?? "", /hello/);
  });

  it("returns null for non-fs tools", async () => {
    const info: SessionRepoInfo = {
      containerName: "/tmp",
      repoDir: "repo",
      workingDir: "/workspace",
      sessionRoot: "/workspace",
      hostWorkingDir: "/tmp"
    };
    assert.equal(
      await executeHostSandboxFsTool({
        info,
        toolName: "run_terminal",
        args: {}
      }),
      null
    );
  });

  it("lists workspace member folders at root", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-sfs-ws-"));
    const frontend = path.join(tmp, "frontend");
    const backend = path.join(tmp, "backend");
    await fs.mkdir(frontend);
    await fs.mkdir(backend);
    await fs.writeFile(path.join(frontend, "pkg.json"), "{}");
    const info: SessionRepoInfo = {
      containerName: tmp,
      repoDir: "frontend",
      workingDir: "/workspace",
      sessionRoot: "/workspace",
      hostWorkingDir: tmp,
      worktrees: {
        frontend: "/workspace/frontend",
        backend: "/workspace/backend"
      },
      hostWorktrees: { frontend, backend }
    };
    const listed = await executeHostSandboxFsTool({
      info,
      toolName: "list_dir",
      args: { path: "" }
    });
    assert.equal(listed?.success, true);
    assert.deepEqual(listed?.metadata?.entries, [
      { name: "backend", path: "backend", isDir: true },
      { name: "frontend", path: "frontend", isDir: true }
    ]);
    const read = await executeHostSandboxFsTool({
      info,
      toolName: "read_file",
      args: { path: "frontend/pkg.json" }
    });
    assert.equal(read?.success, true);
    assert.equal(read?.metadata?.content, "{}");
  });
});
