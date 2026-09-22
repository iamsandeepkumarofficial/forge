import {
  MAX_COST_USD,
  MAX_EXECUTION_TIME_MS,
  MAX_LLM_TOKENS,
  type BudgetStopReason
} from "./types.js";

export type BudgetState = {
  workingMs: number;
  llmTokens: number;
  costUsd: number;
};

export function checkBudget(
  state: BudgetState,
  caps?: Partial<{
    maxExecutionTimeMs: number;
    maxLLMTokens: number;
    maxCostUsd: number;
  }>
): BudgetStopReason | null {
  const maxTime = caps?.maxExecutionTimeMs ?? MAX_EXECUTION_TIME_MS;
  const maxTokens = caps?.maxLLMTokens ?? MAX_LLM_TOKENS;
  const maxCost = caps?.maxCostUsd ?? MAX_COST_USD;
  if (state.workingMs >= maxTime) return "time";
  if (state.llmTokens >= maxTokens) return "tokens";
  if (state.costUsd >= maxCost) return "cost";
  return null;
}

export function accrueWorkingMs(opts: {
  previousWorkingMs: number;
  elapsedMs: number;
  workInFlight: boolean;
}): number {
  if (!opts.workInFlight) return opts.previousWorkingMs;
  return opts.previousWorkingMs + Math.max(0, opts.elapsedMs);
}
