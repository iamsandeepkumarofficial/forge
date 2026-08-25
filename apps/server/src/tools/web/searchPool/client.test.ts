import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("searchViaPool", () => {
  let mode: "ok" | "disabled" = "ok";
  let searchViaPool: (
    query: string,
    maxResults?: number
  ) => Promise<{
    success: boolean;
    output: string;
    metadata: Record<string, unknown>;
  }>;

  before(async () => {
    mock.module("./pool.js", {
      exports: {
        withPoolSlot: async (
          fn: (w: {
            id: string;
            containerName: string;
            state: string;
          }) => Promise<unknown>
        ) => {
          if (mode === "disabled") {
            throw Object.assign(new Error("web tools disabled"), {
              code: "disabled"
            });
          }
          return fn({
            id: "websearch-0",
            containerName: "forge-websearch-0",
            state: "ready"
          });
        },
        recordSearchMetrics: () => undefined
      }
    });
    mock.module("./workerSandbox.js", {
      exports: {
        fetchHtmlInWorker: async () => `
<html><body>
  <a class="result__a" href="https://example.com">Example</a>
  <a class="result__snippet">Snippet text</a>
</body></html>`
      }
    });
    ({ searchViaPool } = await import("./client.js"));
  });

  it("formats successful results from the worker", async () => {
    mode = "ok";
    const r = await searchViaPool("example query", 5);
    assert.equal(r.success, true);
    assert.match(r.output, /Example/);
    assert.equal(r.metadata.resultCount, 1);
  });

  it("maps pool errors into failure metadata codes", async () => {
    mode = "disabled";
    const r = await searchViaPool("q", 3);
    assert.equal(r.success, false);
    assert.equal(r.metadata.code, "disabled");
    assert.match(r.output, /web_search failed/);
  });
});
