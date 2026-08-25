import {
  DEFAULT_WEB_BUDGETS,
  resolveWebBudgets,
  tryConsumeWebBudget,
  type WebBudgetLimits
} from "./budgets.js";
import { webToolsEnabled } from "./enabled.js";
import { playwrightFetchInSession } from "./fetch/playwrightFetch.js";
import { ensureWarmPool } from "./searchPool/pool.js";
import { searchViaPool } from "./searchPool/client.js";

const N_5 = 5;
const N_8 = 8;

export type WebToolExecuteArgs = {
  sessionId: string;
  toolName: "web_search" | "web_fetch";
  args: Record<string, unknown>;
  turnId?: string | null;
  budgets?: Partial<WebBudgetLimits> | null;
};
function budgetKey(sessionId: string, turnId?: string | null): string {
  return turnId?.trim() ? `${sessionId}:${turnId.trim()}` : `${sessionId}:anon`;
}
export async function executeWebTool(input: WebToolExecuteArgs): Promise<{
  success: boolean;
  output: string;
  metadata: Record<string, unknown>;
}> {
  if (!webToolsEnabled()) {
    return {
      success: false,
      output: `${input.toolName} failed: web tools disabled (set WEB_TOOLS_ENABLED=1)`,
      metadata: { code: "disabled" }
    };
  }
  const limits = resolveWebBudgets(input.budgets);
  const key = budgetKey(input.sessionId, input.turnId);
  if (input.toolName === "web_search") {
    const query = typeof input.args.query === "string" ? input.args.query : "";
    if (!query.trim()) {
      return {
        success: false,
        output: "web_search failed: query is required",
        metadata: { code: "provider" }
      };
    }
    const maxResults =
      typeof input.args.maxResults === "number" &&
      Number.isFinite(input.args.maxResults)
        ? Math.max(1, Math.min(N_8, Math.floor(input.args.maxResults)))
        : N_5;
    const consumed = tryConsumeWebBudget({
      budgetKey: key,
      kind: "search",
      limits
    });
    if (!consumed.ok) {
      return {
        success: false,
        output: `web_search failed: ${consumed.reason}`,
        metadata: { code: "budget" }
      };
    }
    await ensureWarmPool();
    return searchViaPool(query, maxResults);
  }
  const url = typeof input.args.url === "string" ? input.args.url : "";
  if (!url.trim()) {
    return {
      success: false,
      output: "web_fetch failed: url is required",
      metadata: { code: "provider" }
    };
  }
  const consumed = tryConsumeWebBudget({
    budgetKey: key,
    kind: "fetch",
    limits
  });
  if (!consumed.ok) {
    return {
      success: false,
      output: `web_fetch failed: ${consumed.reason}`,
      metadata: { code: "budget" }
    };
  }
  return playwrightFetchInSession(input.sessionId, url.trim());
}
export { DEFAULT_WEB_BUDGETS, ensureWarmPool, webToolsEnabled };
