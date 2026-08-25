import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  isGitWorktreeDir,
  listSessionRepoDirNames,
  runTerminalTool
} from "./run_terminal.js";
import type { ToolContext } from "./types.js";

describe("runTerminalTool", () => {
  let tmp: string;
  let ctx: ToolContext;

  before(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "forge-term-"));
    ctx = { cwd: tmp, sessionId: "s1" };
  });

  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("runs a simple command in the session cwd", async () => {
    const result = await runTerminalTool.execute(
      { command: "printf hello" },
      ctx
    );
    assert.equal(result.success, true);
    assert.match(result.output, /hello/);
  });

  it("rejects an empty command", async () => {
    const result = await runTerminalTool.execute({ command: "  " }, ctx);
    assert.equal(result.success, false);
    assert.equal(result.output, "command is required");
  });

  it("requires workingDirectory for git when multiple repos exist", async () => {
    await mkdir(path.join(tmp, "a", ".git"), { recursive: true });
    await mkdir(path.join(tmp, "b", ".git"), { recursive: true });
    const result = await runTerminalTool.execute(
      { command: "git status" },
      ctx
    );
    assert.equal(result.success, false);
    assert.match(result.output, /Pass workingDirectory/);
    assert.match(result.output, /Connected repos/);
  });

  it("lists git worktree dirs", async () => {
    const single = await mkdtemp(path.join(os.tmpdir(), "forge-term-one-"));
    try {
      await mkdir(path.join(single, "only", ".git"), { recursive: true });
      assert.equal(await isGitWorktreeDir(path.join(single, "only")), true);
      assert.deepEqual(await listSessionRepoDirNames(single), ["only"]);
    } finally {
      await rm(single, { recursive: true, force: true });
    }
  });
});
