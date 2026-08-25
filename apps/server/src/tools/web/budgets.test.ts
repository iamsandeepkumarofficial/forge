import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WEB_BUDGETS,
  resetWebBudgetsForTests,
  resolveWebBudgets,
  tryConsumeWebBudget
} from "./budgets.js";
describe("web budgets", () => {
  beforeEach(() => {
    resetWebBudgetsForTests();
  });
  it("resolves defaults and overrides", () => {
    assert.deepEqual(resolveWebBudgets(null), DEFAULT_WEB_BUDGETS);
    assert.equal(resolveWebBudgets({ maxSearches: 2 }).maxSearches, 2);
    assert.equal(
      resolveWebBudgets({ maxSearches: 2 }).maxFetches,
      DEFAULT_WEB_BUDGETS.maxFetches
    );
  });
  it("enforces maxSearches independently of fetches", () => {
    const key = "t1";
    const limits = { maxSearches: 2, maxFetches: 4, maxTotal: 20 };
    assert.equal(
      tryConsumeWebBudget({ budgetKey: key, kind: "search", limits: limits })
        .ok,
      true
    );
    assert.equal(
      tryConsumeWebBudget({ budgetKey: key, kind: "search", limits: limits })
        .ok,
      true
    );
    const third = tryConsumeWebBudget({
      budgetKey: key,
      kind: "search",
      limits: limits
    });
    assert.equal(third.ok, false);
    if (!third.ok) assert.match(third.reason, /maxSearches/);
    assert.equal(
      tryConsumeWebBudget({ budgetKey: key, kind: "fetch", limits: limits }).ok,
      true
    );
  });
  it("enforces maxTotal across kinds", () => {
    const key = "t2";
    const limits = { maxSearches: 8, maxFetches: 4, maxTotal: 3 };
    assert.equal(
      tryConsumeWebBudget({ budgetKey: key, kind: "search", limits: limits })
        .ok,
      true
    );
    assert.equal(
      tryConsumeWebBudget({ budgetKey: key, kind: "fetch", limits: limits }).ok,
      true
    );
    assert.equal(
      tryConsumeWebBudget({ budgetKey: key, kind: "search", limits: limits })
        .ok,
      true
    );
    const over = tryConsumeWebBudget({
      budgetKey: key,
      kind: "fetch",
      limits: limits
    });
    assert.equal(over.ok, false);
    if (!over.ok) assert.match(over.reason, /maxTotal/);
  });
  it("keeps counters per budget key (no cross-turn bleed)", () => {
    const limits = DEFAULT_WEB_BUDGETS;
    for (let i = 0; i < 8; i++) {
      assert.equal(
        tryConsumeWebBudget({
          budgetKey: "turn-a",
          kind: "search",
          limits: limits
        }).ok,
        true
      );
    }
    assert.equal(
      tryConsumeWebBudget({
        budgetKey: "turn-a",
        kind: "search",
        limits: limits
      }).ok,
      false
    );
    assert.equal(
      tryConsumeWebBudget({
        budgetKey: "turn-b",
        kind: "search",
        limits: limits
      }).ok,
      true
    );
  });
});
