import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SANDBOX_TOOL_NAMES } from "./sandbox.tool.js";

describe("sandbox.tool", () => {
  it("exposes the expected sandbox tool names", () => {
    for (const name of [
      "read_file",
      "write_file",
      "edit_file",
      "run_terminal",
      "search_codebase",
      "list_files",
      "list_dir"
    ]) {
      assert.equal(SANDBOX_TOOL_NAMES.has(name), true);
    }
    assert.equal(SANDBOX_TOOL_NAMES.has("web_search"), false);
  });
});
