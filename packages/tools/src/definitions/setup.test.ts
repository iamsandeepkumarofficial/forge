import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setupTools } from "./setup.js";
import type { ToolRun } from "../types.js";

describe("setupTools", () => {
  it("optionally includes docker_image_lookup", () => {
    const run: ToolRun = async () => ({ success: true, output: "ok" });
    assert.ok(setupTools(run).docker_image_lookup);
    assert.equal(
      "docker_image_lookup" in
        setupTools(run, { includeDockerImageLookup: false }),
      false
    );
  });
});
