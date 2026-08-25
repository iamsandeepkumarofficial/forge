import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  collectRelFiles,
  isGitWorktreeDir,
  searchCodebaseTool,
  searchWorkspaceFiles
} from "./search_codebase.js";
import type { ToolContext } from "./types.js";

describe("search_codebase", () => {
  let tmp: string;
  let ctx: ToolContext;

  before(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "forge-search-"));
    ctx = { cwd: tmp, sessionId: "s1" };
    await mkdir(path.join(tmp, "src"), { recursive: true });
    await writeFile(
      path.join(tmp, "src", "app.ts"),
      "const answer = 42;\nexport const name = 'forge';\n",
      "utf8"
    );
    await writeFile(path.join(tmp, "README.md"), "# forge\n", "utf8");
  });

  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("requires a search pattern", async () => {
    const result = await searchCodebaseTool.execute({}, ctx);
    assert.equal(result.success, false);
    assert.equal(result.output, "pattern is required");
  });

  it("returns failure for an invalid regex pattern", async () => {
    const result = await searchCodebaseTool.execute({ pattern: "[" }, ctx);
    assert.equal(result.success, false);
    assert.match(
      result.output,
      /Invalid regular expression|Nothing to repeat|Unterminated/i
    );
  });

  it("searchWorkspaceFiles finds matching lines", async () => {
    const found = await searchWorkspaceFiles(tmp, "forge");
    assert.match(found.output, /src\/app\.ts:\d+:/);
    assert.match(found.output, /README\.md:\d+:/);
  });

  it("collectRelFiles and isGitWorktreeDir work on temp trees", async () => {
    const files = await collectRelFiles(tmp);
    assert.ok(files.includes("src/app.ts"));
    assert.ok(files.includes("README.md"));
    await mkdir(path.join(tmp, "repo", ".git"), { recursive: true });
    assert.equal(await isGitWorktreeDir(path.join(tmp, "repo")), true);
    assert.equal(await isGitWorktreeDir(path.join(tmp, "src")), false);
  });

  it("tool execute reports no matches when file discovery yields no readable paths", async () => {
    const result = await searchCodebaseTool.execute(
      { pattern: "forge", fileGlob: "forge" },
      ctx
    );
    assert.equal(result.success, true);
    assert.equal(result.output, "No matches found.");
  });
});
