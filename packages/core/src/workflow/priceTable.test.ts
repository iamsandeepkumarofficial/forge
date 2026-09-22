import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateCostUsd } from "./priceTable.js";

describe("priceTable", () => {
  it("estimates cost from token counts", () => {
    const promptTokens = 1_000_000;
    const miniInputPerMtok = 0.15;
    const cost = estimateCostUsd({
      model: "gpt-4o-mini",
      promptTokens,
      completionTokens: 0
    });
    assert.equal(cost, miniInputPerMtok);
  });

  it("does not price mini as gpt-4o", () => {
    const promptTokens = 1_000_000;
    const gpt4oInputPerMtok = 2.5;
    const cost = estimateCostUsd({
      model: "gpt-4o",
      promptTokens,
      completionTokens: 0
    });
    assert.equal(cost, gpt4oInputPerMtok);
  });
});
