import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { readFileTool } from "./read_file.js";
import type { ToolContext } from "./types.js";

describe("readFileTool", () => {
  let tmp: string;
  let ctx: ToolContext;

  before(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "forge-read-"));
    ctx = { cwd: tmp, sessionId: "s1" };
  });

  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("reads a file and reports line count", async () => {
    await mkdir(path.join(tmp, "repo"), { recursive: true });
    await writeFile(path.join(tmp, "repo", "note.md"), "a\nb\nc\n", "utf8");
    const result = await readFileTool.execute({ path: "repo/note.md" }, ctx);
    assert.equal(result.success, true);
    assert.match(result.output, /Read repo\/note\.md \(4 lines\)/);
    assert.match(result.output, /a\nb\nc/);
  });

  it("returns failure when the file is missing", async () => {
    const result = await readFileTool.execute({ path: "nope.txt" }, ctx);
    assert.equal(result.success, false);
    assert.match(result.output, /File not found: nope\.txt/);
  });
});
