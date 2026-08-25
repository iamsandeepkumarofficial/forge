import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  webToolsEnabled,
  webSearchMinWarm,
  webSearchMaxWorkers,
  webSearchTargetLatencyMs
} from "./enabled.js";

const KEYS = [
  "WEB_TOOLS_ENABLED",
  "WEB_SEARCH_MIN_WARM",
  "WEB_SEARCH_MAX_WORKERS",
  "WEB_SEARCH_TARGET_LATENCY_MS"
] as const;

const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

describe("web enabled helpers", () => {
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      const v = saved[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("webToolsEnabled is false when unset or empty", () => {
    assert.equal(webToolsEnabled(), false);
    process.env.WEB_TOOLS_ENABLED = "  ";
    assert.equal(webToolsEnabled(), false);
  });

  it("webToolsEnabled accepts 1/true/yes/on case-insensitively", () => {
    for (const v of ["1", "true", "TRUE", "yes", "on", " On "]) {
      process.env.WEB_TOOLS_ENABLED = v;
      assert.equal(webToolsEnabled(), true, v);
    }
    for (const v of ["0", "false", "no", "off", "maybe"]) {
      process.env.WEB_TOOLS_ENABLED = v;
      assert.equal(webToolsEnabled(), false, v);
    }
  });

  it("webSearchMinWarm defaults to 1 and floors valid numbers", () => {
    assert.equal(webSearchMinWarm(), 1);
    process.env.WEB_SEARCH_MIN_WARM = "3.9";
    assert.equal(webSearchMinWarm(), 3);
    process.env.WEB_SEARCH_MIN_WARM = "0";
    assert.equal(webSearchMinWarm(), 0);
    process.env.WEB_SEARCH_MIN_WARM = "-1";
    assert.equal(webSearchMinWarm(), 1);
    process.env.WEB_SEARCH_MIN_WARM = "nope";
    assert.equal(webSearchMinWarm(), 1);
  });

  it("webSearchMaxWorkers defaults to 5 and requires >= 1", () => {
    assert.equal(webSearchMaxWorkers(), 5);
    process.env.WEB_SEARCH_MAX_WORKERS = "8.2";
    assert.equal(webSearchMaxWorkers(), 8);
    process.env.WEB_SEARCH_MAX_WORKERS = "0";
    assert.equal(webSearchMaxWorkers(), 5);
  });

  it("webSearchTargetLatencyMs defaults to 8000 and requires > 0", () => {
    assert.equal(webSearchTargetLatencyMs(), 8000);
    process.env.WEB_SEARCH_TARGET_LATENCY_MS = "1200.7";
    assert.equal(webSearchTargetLatencyMs(), 1200);
    process.env.WEB_SEARCH_TARGET_LATENCY_MS = "0";
    assert.equal(webSearchTargetLatencyMs(), 8000);
  });
});
