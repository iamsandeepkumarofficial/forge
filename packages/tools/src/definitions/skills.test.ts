import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { skillTools } from "./skills.js";
import type { ToolRun } from "../types.js";

describe("skillTools", () => {
  it("exposes skill tools", () => {
    const run: ToolRun = async () => ({ success: true, output: "ok" });
    const tools = skillTools(run);
    assert.ok(tools.list_skills);
    assert.ok(tools.invoke_skill);
  });
});
