import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { workspaceFileTools } from "./files.js";
import type { ToolRun } from "../types.js";

describe("workspaceFileTools", () => {
  it("exposes file tools", () => {
    const run: ToolRun = async () => ({ success: true, output: "ok" });
    const tools = workspaceFileTools(run);
    assert.ok(tools.read_file);
    assert.ok(tools.write_file);
    assert.ok(tools.edit_file);
    assert.ok(tools.delete_files);
    assert.ok(tools.move_files);
  });
});
