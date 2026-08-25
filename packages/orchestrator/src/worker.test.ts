import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatTemporalConnectError, runWorker } from "./worker.js";

describe("worker", () => {
  it("formatTemporalConnectError wraps connection refused", () => {
    const err = formatTemporalConnectError(
      "localhost:7233",
      new Error("Connection refused")
    );
    assert.match(err.message, /Cannot reach Temporal at localhost:7233/);
    assert.match(err.message, /pnpm temporal:dev/);
  });

  it("formatTemporalConnectError wraps tcp connect error", () => {
    const err = formatTemporalConnectError(
      "temporal:7233",
      new Error("tcp connect error: ConnectionRefused")
    );
    assert.match(err.message, /Cannot reach Temporal at temporal:7233/);
  });

  it("formatTemporalConnectError rethrows unrelated Error", () => {
    const original = new Error("boom");
    const err = formatTemporalConnectError("localhost:7233", original);
    assert.equal(err, original);
  });

  it("formatTemporalConnectError wraps non-Error values", () => {
    const err = formatTemporalConnectError("localhost:7233", "weird");
    assert.equal(err.message, "weird");
  });

  it("exports runWorker without starting on import", () => {
    assert.equal(typeof runWorker, "function");
  });
});
