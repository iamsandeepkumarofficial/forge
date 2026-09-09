import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  forgeRuntimeBin,
  forgeRuntimeDownloads,
  forgeRuntimeExtract,
  forgeRuntimeRoot
} from "./paths.js";

describe("hostInfra paths", () => {
  it("builds runtime paths under the given home", () => {
    const home = "/tmp/forge-home";
    const root = forgeRuntimeRoot(home);
    assert.equal(root, join(home, ".forge", "runtime"));
    assert.equal(forgeRuntimeBin(home), join(root, "bin"));
    assert.equal(forgeRuntimeDownloads(home), join(root, "downloads"));
    assert.equal(forgeRuntimeExtract(home), join(root, "extract"));
  });
});
