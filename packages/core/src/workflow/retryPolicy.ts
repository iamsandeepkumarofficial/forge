import { MAX_TASK_ATTEMPTS } from "./types.js";

export type RetryDecision =
  | { action: "retry"; nextAttempt: number }
  | { action: "skip"; reason: "non_idempotent" | "exhausted" };

export function shouldRetryTask(opts: {
  idempotent: boolean;
  attemptCount: number;
  maxAttempts?: number;
}): RetryDecision {
  const max = opts.maxAttempts ?? MAX_TASK_ATTEMPTS;
  if (!opts.idempotent) {
    return { action: "skip", reason: "non_idempotent" };
  }
  if (opts.attemptCount >= max) {
    return { action: "skip", reason: "exhausted" };
  }
  return { action: "retry", nextAttempt: opts.attemptCount + 1 };
}
