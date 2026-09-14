import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkHostToolchain } from "./hostToolchain.js";

describe("hostToolchain", () => {
  it("checks git only (not language runtimes)", async () => {
    const report = await checkHostToolchain();
    assert.equal(typeof report.ok, "boolean");
    assert.ok(Array.isArray(report.missing));
    assert.ok(Array.isArray(report.guidance));
    assert.ok(!report.missing.includes("node"));
    assert.ok(
      report.guidance.every((g) => !/Node\.js/i.test(g)),
      "bootstrap must not require Node"
    );
    if (!report.ok) {
      assert.deepEqual(report.missing, ["git"]);
    }
  });
});
