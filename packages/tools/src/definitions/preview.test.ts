import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previewTools } from "./preview.js";
import type { ToolRun } from "../types.js";

describe("previewTools", () => {
  it("exposes preview tools", () => {
    const run: ToolRun = async () => ({ success: true, output: "ok" });
    const tools = previewTools(run);
    assert.ok(tools.preview_start);
    assert.ok(tools.upsert_launch_app);
  });
});
