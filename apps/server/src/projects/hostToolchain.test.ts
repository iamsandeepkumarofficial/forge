import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkHostToolchain } from "./hostToolchain.js";

describe("hostToolchain", () => {
  it("reports git and node presence without throwing", async () => {
    const report = await checkHostToolchain();
    assert.equal(typeof report.ok, "boolean");
    assert.ok(Array.isArray(report.missing));
    assert.ok(Array.isArray(report.guidance));
    if (!report.ok) {
      assert.ok(report.missing.length > 0);
      assert.ok(report.guidance.length > 0);
    }
  });
});
