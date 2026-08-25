import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  poolRpm,
  poolMeanLatencyMs,
  recordSearchMetrics,
  pickWorker,
  listWorkers,
  ensureWarmPool
} from "./pool.js";

describe("web search pool metrics", () => {
  const prev = process.env.WEB_TOOLS_ENABLED;

  beforeEach(() => {
    delete process.env.WEB_TOOLS_ENABLED;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.WEB_TOOLS_ENABLED;
    else process.env.WEB_TOOLS_ENABLED = prev;
  });

  it("recordSearchMetrics updates rpm and mean latency", () => {
    const beforeRpm = poolRpm();
    recordSearchMetrics(100);
    recordSearchMetrics(300);
    assert.ok(poolRpm() >= beforeRpm + 2);
    assert.ok(poolMeanLatencyMs() > 0);
  });

  it("pickWorker returns null when pool is empty", () => {
    assert.equal(pickWorker(), null);
    assert.deepEqual(listWorkers(), []);
  });

  it("ensureWarmPool is a no-op when tools disabled", async () => {
    await ensureWarmPool();
    assert.deepEqual(listWorkers(), []);
  });
});
