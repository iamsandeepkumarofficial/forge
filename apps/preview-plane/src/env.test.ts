import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("preview-plane env", () => {
  it("loads without throwing when imported", async () => {
    await import("./env.js");
    assert.ok(true);
  });
});
