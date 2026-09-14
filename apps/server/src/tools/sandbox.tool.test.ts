import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SANDBOX_TOOL_NAMES, pathOpts } from "./sandbox.tool.js";

describe("sandbox.tool", () => {
  it("exposes the expected sandbox tool names", () => {
    for (const name of [
      "read_file",
      "write_file",
      "edit_file",
      "delete_files",
      "move_files",
      "run_terminal",
      "search_codebase",
      "list_files",
      "list_dir"
    ]) {
      assert.equal(SANDBOX_TOOL_NAMES.has(name), true);
    }
    assert.equal(SANDBOX_TOOL_NAMES.has("web_search"), false);
  });

  it("pathOpts requires member repo prefixes for any workspace worktrees", () => {
    assert.deepEqual(pathOpts(undefined), {});
    assert.deepEqual(pathOpts({}), {});

    const single = pathOpts({ frontend: "/workspace/frontend" });
    assert.ok(single.knownRepos);
    assert.deepEqual([...single.knownRepos!].sort(), ["frontend"]);

    const multi = pathOpts({
      frontend: "/workspace/frontend",
      backend: "/workspace/backend"
    });
    assert.ok(multi.knownRepos);
    assert.deepEqual([...multi.knownRepos!].sort(), ["backend", "frontend"]);
  });
});
