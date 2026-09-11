import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  checkpointGitRepo,
  checkpointRefForTurn,
  createLocalGitRunner,
  parseWorkspaceCheckpoint,
  restoreGitRepo
} from "./workspaceCheckpoint.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout.trim();
}

const TURN_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("workspaceCheckpoint", () => {
  let tmpRoot: string;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-ckpt-"));
  });

  after(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("parses repo-to-sha maps and rejects junk", () => {
    assert.deepEqual(
      parseWorkspaceCheckpoint({
        portfolio: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        skip: "not-a-sha",
        empty: ""
      }),
      { portfolio: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
    );
    assert.deepEqual(parseWorkspaceCheckpoint(null), {});
    assert.deepEqual(parseWorkspaceCheckpoint(["x"]), {});
  });

  it("snapshots via hidden ref without moving HEAD, then restore discards later edits", async () => {
    const cwd = path.join(tmpRoot, "repo");
    await fs.mkdir(cwd, { recursive: true });
    await fs.writeFile(path.join(cwd, "README.md"), "base\n");
    await fs.writeFile(path.join(cwd, ".gitignore"), "node_modules\n");
    await git(cwd, ["init"]);
    await git(cwd, ["config", "user.email", "t@t"]);
    await git(cwd, ["config", "user.name", "t"]);
    await git(cwd, ["add", "-A"]);
    await git(cwd, ["commit", "-m", "init"]);
    await fs.writeFile(path.join(cwd, "app.js"), "console.log(1)\n");
    await fs.mkdir(path.join(cwd, "node_modules"), { recursive: true });
    await fs.writeFile(path.join(cwd, "node_modules", "keep.txt"), "deps\n");

    const headBefore = await git(cwd, ["rev-parse", "HEAD"]);
    const runner = createLocalGitRunner(cwd);
    const sha = await checkpointGitRepo({ git: runner, turnId: TURN_ID });
    assert.ok(sha);
    assert.equal(await git(cwd, ["rev-parse", "HEAD"]), headBefore);
    assert.equal(
      await git(cwd, ["rev-parse", checkpointRefForTurn(TURN_ID)]),
      sha
    );
    const log = await git(cwd, ["log", "--format=%s"]);
    assert.equal(log.includes("forge-checkpoint"), false);
    const staged = await git(cwd, ["diff", "--cached", "--name-only"]);
    assert.equal(staged, "");

    await fs.writeFile(path.join(cwd, "app.js"), "console.log(2)\n");
    await fs.writeFile(path.join(cwd, "extra.txt"), "later\n");
    await restoreGitRepo({ git: runner, sha: sha as string });

    assert.equal(await git(cwd, ["rev-parse", "HEAD"]), sha);
    assert.equal(
      await fs.readFile(path.join(cwd, "app.js"), "utf8"),
      "console.log(1)\n"
    );
    await fs.access(path.join(cwd, "extra.txt")).then(
      () => {
        throw new Error("extra.txt should be removed by git clean -fd");
      },
      () => undefined
    );
    assert.equal(
      await fs.readFile(path.join(cwd, "node_modules", "keep.txt"), "utf8"),
      "deps\n"
    );
  });

  it("skips a folder that is not a git repo", async () => {
    const cwd = path.join(tmpRoot, "plain");
    await fs.mkdir(cwd, { recursive: true });
    const sha = await checkpointGitRepo({
      git: createLocalGitRunner(cwd),
      turnId: TURN_ID
    });
    assert.equal(sha, null);
  });
});
