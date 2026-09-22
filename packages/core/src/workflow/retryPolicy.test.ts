import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldRetryTask } from "./retryPolicy.js";

describe("shouldRetryTask", () => {
  it("retries idempotent failures under max attempts", () => {
    const d = shouldRetryTask({ idempotent: true, attemptCount: 1 });
    assert.deepEqual(d, { action: "retry", nextAttempt: 2 });
  });

  it("skips non-idempotent tasks", () => {
    const d = shouldRetryTask({ idempotent: false, attemptCount: 0 });
    assert.equal(d.action, "skip");
    if (d.action === "skip") assert.equal(d.reason, "non_idempotent");
  });

  it("stops after max attempts", () => {
    const d = shouldRetryTask({
      idempotent: true,
      attemptCount: 3,
      maxAttempts: 3
    });
    assert.equal(d.action, "skip");
  });
});
