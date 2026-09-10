import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ensureWorkspaceMemberCopy,
  resolveSourceRef
} from "./workspaceMaterialize.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout.trim();
}

describe("workspaceMaterialize", () => {
  let tmpRoot: string;
  let prevWorkspacesRoot: string | undefined;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-ws-mat-"));
    prevWorkspacesRoot = process.env.FORGE_WORKSPACES_ROOT;
    process.env.FORGE_WORKSPACES_ROOT = path.join(tmpRoot, "workspaces");
  });

  after(async () => {
    if (prevWorkspacesRoot === undefined) {
      delete process.env.FORGE_WORKSPACES_ROOT;
    } else {
      process.env.FORGE_WORKSPACES_ROOT = prevWorkspacesRoot;
    }
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("resolveSourceRef defaults to main when unset", () => {
    assert.equal(
      resolveSourceRef({ sourceRef: null, defaultBranch: "main" }),
      "main"
    );
    assert.equal(
      resolveSourceRef({ sourceRef: " feature ", defaultBranch: "main" }),
      "feature"
    );
  });

  it("clones canonical once into durable member dir", async () => {
    const canonical = path.join(tmpRoot, "canonical");
    await fs.mkdir(canonical, { recursive: true });
    await fs.writeFile(path.join(canonical, "pkg.json"), '{"name":"x"}\n');
    await git(canonical, ["init"]);
    await git(canonical, ["config", "user.email", "t@t"]);
    await git(canonical, ["config", "user.name", "t"]);
    await git(canonical, ["add", "-A"]);
    await git(canonical, ["commit", "-m", "init"]);
    await git(canonical, ["branch", "-M", "main"]);

    const first = await ensureWorkspaceMemberCopy({
      workspaceId: "ws1",
      repoName: "frontend",
      canonicalKey: canonical,
      sourceRef: null
    });
    assert.equal(first.sourceRef, "main");
    const pkg = await fs.readFile(
      path.join(first.memberDir, "pkg.json"),
      "utf8"
    );
    assert.match(pkg, /"name":"x"/);

    const second = await ensureWorkspaceMemberCopy({
      workspaceId: "ws1",
      repoName: "frontend",
      canonicalKey: canonical,
      sourceRef: "main"
    });
    assert.equal(second.memberDir, first.memberDir);
  });
});
