import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  canonicalGitContainerPath,
  ensureCanonicalGitRepo,
  ensureSessionWorktree,
  mergeSessionBranchIntoCanonical,
  removeSessionWorktree,
  worktreeWorkDir
} from "./localWorktree.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout.trim();
}

describe("localWorktree", () => {
  let tmpRoot: string;
  let prevSessionsRoot: string | undefined;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-wt-"));
    prevSessionsRoot = process.env.FORGE_SESSIONS_ROOT;
    process.env.FORGE_SESSIONS_ROOT = path.join(tmpRoot, "sessions");
  });

  after(async () => {
    if (prevSessionsRoot === undefined) {
      delete process.env.FORGE_SESSIONS_ROOT;
    } else {
      process.env.FORGE_SESSIONS_ROOT = prevSessionsRoot;
    }
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("ensureCanonicalGitRepo inits a non-git folder", async () => {
    const canonical = path.join(tmpRoot, "proj-init");
    await fs.mkdir(canonical, { recursive: true });
    await fs.writeFile(path.join(canonical, "README.md"), "hello\n");
    await ensureCanonicalGitRepo(canonical);
    const head = await git(canonical, ["rev-parse", "--is-inside-work-tree"]);
    assert.equal(head, "true");
    const log = await git(canonical, ["log", "-1", "--pretty=%s"]);
    assert.equal(log, "forge: initial import");
  });

  it("ensureSessionWorktree tolerates concurrent worktree add", async () => {
    const projectId = "proj-race";
    const sessionId = "session-race";
    const branchName = "workbench-race";
    const canonical = path.join(tmpRoot, "proj-race-canon");
    await fs.mkdir(canonical, { recursive: true });
    await fs.writeFile(path.join(canonical, "app.js"), "console.log(1)\n");
    await ensureCanonicalGitRepo(canonical);

    const workDir = worktreeWorkDir(projectId, sessionId);
    const opts = {
      canonicalKey: canonical,
      projectId,
      sessionId,
      branchName
    };
    await Promise.all([
      ensureSessionWorktree(opts),
      ensureSessionWorktree(opts)
    ]);

    await fs.access(workDir);
    await removeSessionWorktree({
      canonicalKey: canonical,
      projectId,
      sessionId
    });
  });

  it("ensureSessionWorktree rewrites .git pointer to /forge-git/{id}", async () => {
    const projectId = "proj-a";
    const sessionId = "session-1";
    const canonical = path.join(tmpRoot, "proj-a-canon");
    await fs.mkdir(canonical, { recursive: true });
    await fs.writeFile(path.join(canonical, "app.js"), "console.log(1)\n");
    await ensureCanonicalGitRepo(canonical);

    const wt = await ensureSessionWorktree({
      canonicalKey: canonical,
      projectId,
      sessionId,
      branchName: "chat-session-1"
    });

    assert.equal(wt.workDir, worktreeWorkDir(projectId, sessionId));
    assert.equal(wt.gitCanonicalHostPath, path.join(canonical, ".git"));

    const pointer = await fs.readFile(path.join(wt.workDir, ".git"), "utf8");
    assert.match(
      pointer,
      new RegExp(
        `^gitdir: ${canonicalGitContainerPath(projectId)}/worktrees/`
      )
    );
    assert.ok(pointer.includes("/worktrees/"));

    // Branch exists on canonical (shared refs)
    const branches = await git(canonical, ["branch", "--list", "chat-session-1"]);
    assert.match(branches, /chat-session-1/);

    await removeSessionWorktree({
      canonicalKey: canonical,
      projectId,
      sessionId
    });
    await assert.rejects(() => fs.access(wt.workDir));
  });

  it("mergeSessionBranchIntoCanonical fast-forwards default branch", async () => {
    const canonical = path.join(tmpRoot, "proj-merge");
    await fs.mkdir(canonical, { recursive: true });
    await fs.writeFile(path.join(canonical, "base.txt"), "base\n");
    await ensureCanonicalGitRepo(canonical);

    const defaultBranch = await git(canonical, [
      "rev-parse",
      "--abbrev-ref",
      "HEAD"
    ]);

    await git(canonical, ["checkout", "-B", "chat-promote"]);
    await fs.writeFile(path.join(canonical, "base.txt"), "promoted\n");
    await git(canonical, ["add", "-A"]);
    await git(canonical, ["commit", "-m", "session change"]);
    await git(canonical, ["checkout", defaultBranch]);

    await mergeSessionBranchIntoCanonical({
      canonicalKey: canonical,
      branchName: "chat-promote"
    });
    const content = await fs.readFile(path.join(canonical, "base.txt"), "utf8");
    assert.equal(content, "promoted\n");
  });
});
