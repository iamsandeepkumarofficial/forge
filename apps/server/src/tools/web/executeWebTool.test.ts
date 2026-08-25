import { describe, it, beforeEach, afterEach, mock, before } from "node:test";
import assert from "node:assert/strict";
import { resetWebBudgetsForTests } from "./budgets.js";

const KEYS = ["WEB_TOOLS_ENABLED"] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

describe("executeWebTool", () => {
  const fetchMock = mock.fn(async () => ({
    success: true,
    output: "body",
    metadata: { code: "ok" }
  }));
  const searchMock = mock.fn(async () => ({
    success: true,
    output: "ok",
    metadata: {}
  }));
  let executeWebTool: (input: {
    sessionId: string;
    toolName: "web_search" | "web_fetch";
    args: Record<string, unknown>;
    turnId?: string | null;
    budgets?: { maxSearches: number; maxFetches: number; maxTotal: number };
  }) => Promise<{
    success: boolean;
    output: string;
    metadata: Record<string, unknown>;
  }>;

  before(async () => {
    mock.module("./searchPool/pool.js", {
      exports: {
        ensureWarmPool: async () => undefined
      }
    });
    mock.module("./searchPool/client.js", {
      exports: {
        searchViaPool: searchMock
      }
    });
    mock.module("./fetch/playwrightFetch.js", {
      exports: {
        playwrightFetchInSession: fetchMock
      }
    });
    ({ executeWebTool } = await import("./executeWebTool.js"));
  });

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    resetWebBudgetsForTests();
    fetchMock.mock.resetCalls();
    searchMock.mock.resetCalls();
  });

  afterEach(() => {
    for (const k of KEYS) {
      const v = saved[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("returns disabled when WEB_TOOLS_ENABLED is off", async () => {
    const r = await executeWebTool({
      sessionId: "s1",
      toolName: "web_search",
      args: { query: "hello" },
      turnId: "t1"
    });
    assert.equal(r.success, false);
    assert.equal(r.metadata.code, "disabled");
    assert.match(r.output, /web tools disabled/);
  });

  it("rejects empty web_search query", async () => {
    process.env.WEB_TOOLS_ENABLED = "1";
    const r = await executeWebTool({
      sessionId: "s1",
      toolName: "web_search",
      args: { query: "  " },
      turnId: "t1"
    });
    assert.equal(r.success, false);
    assert.equal(r.metadata.code, "provider");
    assert.match(r.output, /query is required/);
  });

  it("rejects empty web_fetch url", async () => {
    process.env.WEB_TOOLS_ENABLED = "true";
    const r = await executeWebTool({
      sessionId: "s1",
      toolName: "web_fetch",
      args: { url: "" },
      turnId: "t1"
    });
    assert.equal(r.success, false);
    assert.equal(r.metadata.code, "provider");
    assert.match(r.output, /url is required/);
  });

  it("enforces search budget before calling the pool", async () => {
    process.env.WEB_TOOLS_ENABLED = "1";
    const limits = { maxSearches: 1, maxFetches: 4, maxTotal: 20 };
    const first = await executeWebTool({
      sessionId: "budget-s",
      toolName: "web_search",
      args: { query: "a" },
      turnId: "t-budget",
      budgets: limits
    });
    assert.equal(first.success, true);
    assert.equal(searchMock.mock.callCount(), 1);
    const second = await executeWebTool({
      sessionId: "budget-s",
      toolName: "web_search",
      args: { query: "b" },
      turnId: "t-budget",
      budgets: limits
    });
    assert.equal(second.success, false);
    assert.equal(second.metadata.code, "budget");
    assert.match(second.output, /maxSearches/);
  });

  it("delegates web_fetch to playwrightFetchInSession when budget allows", async () => {
    process.env.WEB_TOOLS_ENABLED = "1";
    const r = await executeWebTool({
      sessionId: "s-fetch",
      toolName: "web_fetch",
      args: { url: "https://example.com/docs" },
      turnId: "t-fetch"
    });
    assert.equal(r.success, true);
    assert.equal(r.output, "body");
    assert.equal(fetchMock.mock.callCount(), 1);
    const call = fetchMock.mock.calls[0]!;
    assert.equal(call.arguments[0], "s-fetch");
    assert.equal(call.arguments[1], "https://example.com/docs");
  });
});
