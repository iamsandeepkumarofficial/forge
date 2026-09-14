import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { optionalWebTools } from "./web.js";
import type { ToolRun } from "../types.js";

describe("optionalWebTools", () => {
  it("exposes web_search and web_fetch", () => {
    const run: ToolRun = async () => ({ success: true, output: "ok" });
    const tools = optionalWebTools(run);
    assert.ok(tools.web_search);
    assert.ok(tools.web_fetch);
  });
});
