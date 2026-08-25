import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { editFileTool } from "./edit_file.js";
import type { ToolContext } from "./types.js";

describe("editFileTool", () => {
  let tmp: string;
  let ctx: ToolContext;

  before(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "forge-edit-"));
    ctx = { cwd: tmp, sessionId: "s1" };
  });

  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("replaces the first matching block", async () => {
    await writeFile(path.join(tmp, "a.txt"), "one two one", "utf8");
    const result = await editFileTool.execute(
      { path: "a.txt", oldString: "one", newString: "ONE" },
      ctx
    );
    assert.equal(result.success, true);
    assert.equal(
      await readFile(path.join(tmp, "a.txt"), "utf8"),
      "ONE two one"
    );
  });

  it("replaceAll swaps every occurrence", async () => {
    await writeFile(path.join(tmp, "b.txt"), "x x x", "utf8");
    const result = await editFileTool.execute(
      {
        path: "b.txt",
        oldString: "x",
        newString: "y",
        replaceAll: true
      },
      ctx
    );
    assert.equal(result.success, true);
    assert.equal(await readFile(path.join(tmp, "b.txt"), "utf8"), "y y y");
  });

  it("fails when the file does not exist", async () => {
    const result = await editFileTool.execute(
      { path: "missing.txt", oldString: "a", newString: "b" },
      ctx
    );
    assert.equal(result.success, false);
    assert.match(result.output, /File not found/);
  });

  it("fails when oldString is not present", async () => {
    await writeFile(path.join(tmp, "c.txt"), "hello", "utf8");
    const result = await editFileTool.execute(
      { path: "c.txt", oldString: "nope", newString: "yes" },
      ctx
    );
    assert.equal(result.success, false);
    assert.match(result.output, /Could not find the exact text/);
  });
});
