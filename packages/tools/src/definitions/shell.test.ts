import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shellTools } from "./shell.js";
import type { ToolRun } from "../types.js";

describe("shellTools", () => {
  it("exposes run_terminal", () => {
    const run: ToolRun = async () => ({ success: true, output: "ok" });
    assert.ok(shellTools(run).run_terminal);
  });
});
