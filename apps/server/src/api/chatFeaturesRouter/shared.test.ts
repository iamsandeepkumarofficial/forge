import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { param, valuesEqual, VALID_PRIORITIES } from "./shared.js";

describe("chatFeaturesRouter shared", () => {
  it("param unwraps arrays", () => {
    assert.equal(param("x"), "x");
    assert.equal(param(["y", "z"]), "y");
  });

  it("valuesEqual compares dates and nullish", () => {
    const d = new Date("2020-01-01");
    assert.equal(valuesEqual(d, new Date(d.getTime())), true);
    assert.equal(valuesEqual(null, undefined), true);
    assert.equal(valuesEqual(1, 2), false);
  });

  it("exposes priority list", () => {
    assert.ok(VALID_PRIORITIES.includes("urgent"));
  });
});
