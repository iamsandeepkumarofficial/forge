import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { writeFileTool } from "./write_file.js";
import type { ToolContext } from "./types.js";

describe("writeFileTool", () => {
  let tmp: string;
  let ctx: ToolContext;

  before(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "forge-write-"));
    ctx = { cwd: tmp, sessionId: "s1" };
  });

  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("writes a new file including nested directories", async () => {
    const result = await writeFileTool.execute(
      { path: "repo/src/hello.ts", content: "export const n = 1;\n" },
      ctx
    );
    assert.equal(result.success, true);
    assert.match(result.output, /Wrote repo\/src\/hello\.ts/);
    const text = await readFile(path.join(tmp, "repo/src/hello.ts"), "utf8");
    assert.equal(text, "export const n = 1;\n");
  });

  it("overwrites an existing file", async () => {
    await writeFileTool.execute({ path: "file.txt", content: "first" }, ctx);
    const result = await writeFileTool.execute(
      { path: "file.txt", content: "second" },
      ctx
    );
    assert.equal(result.success, true);
    assert.equal(await readFile(path.join(tmp, "file.txt"), "utf8"), "second");
  });

  it("writes empty content when content is omitted", async () => {
    const result = await writeFileTool.execute({ path: "empty.txt" }, ctx);
    assert.equal(result.success, true);
    assert.equal(await readFile(path.join(tmp, "empty.txt"), "utf8"), "");
  });
});
