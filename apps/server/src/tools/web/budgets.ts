export type WebBudgetLimits = {
  maxSearches: number;
  maxFetches: number;
  maxTotal: number;
};
export const DEFAULT_WEB_BUDGETS: WebBudgetLimits = {
  maxSearches: 8,
  maxFetches: 4,
  maxTotal: 20
};
type Counter = {
  searches: number;
  fetches: number;
  total: number;
};
const counters = new Map<string, Counter>();
export function resolveWebBudgets(
  partial?: Partial<WebBudgetLimits> | null
): WebBudgetLimits {
  return {
    maxSearches: partial?.maxSearches ?? DEFAULT_WEB_BUDGETS.maxSearches,
    maxFetches: partial?.maxFetches ?? DEFAULT_WEB_BUDGETS.maxFetches,
    maxTotal: partial?.maxTotal ?? DEFAULT_WEB_BUDGETS.maxTotal
  };
}
function getCounter(key: string): Counter {
  let c = counters.get(key);
  if (!c) {
    c = { searches: 0, fetches: 0, total: 0 };
    counters.set(key, c);
  }
  return c;
}
export type BudgetKind = "search" | "fetch";
export function tryConsumeWebBudget(options: {
  budgetKey: string;
  kind: BudgetKind;
  limits?: WebBudgetLimits;
}):
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: string;
    } {
  const limits = options.limits ?? DEFAULT_WEB_BUDGETS;
  const c = getCounter(options.budgetKey);
  if (c.total >= limits.maxTotal) {
    return {
      ok: false,
      reason: `web tool budget exceeded: maxTotal=${limits.maxTotal}`
    };
  }
  if (options.kind === "search" && c.searches >= limits.maxSearches) {
    return {
      ok: false,
      reason: `web_search budget exceeded: maxSearches=${limits.maxSearches}`
    };
  }
  if (options.kind === "fetch" && c.fetches >= limits.maxFetches) {
    return {
      ok: false,
      reason: `web_fetch budget exceeded: maxFetches=${limits.maxFetches}`
    };
  }
  c.total += 1;
  if (options.kind === "search") c.searches += 1;
  else c.fetches += 1;
  return { ok: true };
}
export function resetWebBudgetsForTests(): void {
  counters.clear();
}
