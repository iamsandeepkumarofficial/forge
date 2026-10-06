import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accrueWorkingMs, checkBudget } from "./budget.js";
import { MAX_COST_USD, MAX_LLM_TOKENS } from "./types.js";

describe("budget", () => {
  const previousMs = 1000;
  const elapsedMs = 5000;
  const accruedMs = 6000;

  it("does not accrue while idle", () => {
    assert.equal(
      accrueWorkingMs({
        previousWorkingMs: previousMs,
        elapsedMs,
        workInFlight: false
      }),
      previousMs
    );
  });

  it("accrues while work is in flight", () => {
    assert.equal(
      accrueWorkingMs({
        previousWorkingMs: previousMs,
        elapsedMs,
        workInFlight: true
      }),
      accruedMs
    );
  });

  it("stops on token and cost caps", () => {
    assert.equal(
      checkBudget({ workingMs: 0, llmTokens: MAX_LLM_TOKENS, costUsd: 0 }),
      "tokens"
    );
    assert.equal(
      checkBudget({ workingMs: 0, llmTokens: 0, costUsd: MAX_COST_USD }),
      "cost"
    );
  });
});
