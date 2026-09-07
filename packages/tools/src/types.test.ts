import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ToolRun } from "./types.js";

describe("types", () => {
  it("ToolRun accepts plain objects", async () => {
    const run: ToolRun = async (name, args) => ({
      success: true,
      output: `${name}:${Object.keys(args).join(",")}`
    });
    const r = await run("read_file", { path: "a.ts" });
    assert.equal(r.success, true);
    assert.match(r.output, /read_file:path/);
  });
});
