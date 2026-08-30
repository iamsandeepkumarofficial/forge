import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PREVIEW_PARTITION } from "./types.js";

describe("electronViews", () => {
  it("uses an isolated preview partition", () => {
    assert.equal(PREVIEW_PARTITION, "persist:forge-preview");
  });
});
