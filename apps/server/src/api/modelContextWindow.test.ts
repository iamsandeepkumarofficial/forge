import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  resolveModelContextWindow,
  resolveModelTokenLimits
} from "./modelContextWindow.js";

describe("resolveModelContextWindow", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restoreAll();
  });

  it("returns null for blank model ids", async () => {
    assert.equal(await resolveModelContextWindow("openai", "  "), null);
  });

  it("looks up OpenAI table sizes", async () => {
    assert.equal(
      await resolveModelContextWindow("openai", "gpt-4o-mini"),
      128000
    );
    assert.equal(await resolveModelContextWindow("openai", "gpt-4-32k"), 32768);
    assert.equal(await resolveModelContextWindow("openai", "o3-mini"), 200000);
    assert.equal(
      await resolveModelContextWindow("openai", "unknown-model"),
      null
    );
  });

  it("looks up Anthropic table sizes", async () => {
    assert.equal(
      await resolveModelContextWindow(
        "anthropic",
        "claude-3-5-sonnet-20241022"
      ),
      200000
    );
    assert.equal(
      await resolveModelContextWindow("anthropic", "claude-2.1"),
      200000
    );
    assert.equal(
      await resolveModelContextWindow("anthropic", "claude-2"),
      100000
    );
  });

  it("resolves custom host context via mocked fetch", async () => {
    const prev = process.env.CUSTOM_BASE_URL;
    process.env.CUSTOM_BASE_URL = "http://lm.local/v1";
    globalThis.fetch = mock.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v0/models/")) {
        return new Response(JSON.stringify({ context_length: 32768 }), {
          status: 200
        });
      }
      return new Response("missing", { status: 404 });
    }) as typeof fetch;
    try {
      const n = await resolveModelContextWindow(
        "openai-compatible",
        "local-model"
      );
      assert.equal(n, 32768);
    } finally {
      if (prev === undefined) delete process.env.CUSTOM_BASE_URL;
      else process.env.CUSTOM_BASE_URL = prev;
    }
  });

  it("reads max completion tokens from custom /models metadata", async () => {
    const prev = process.env.CUSTOM_BASE_URL;
    process.env.CUSTOM_BASE_URL = "http://openrouter.local/v1";
    globalThis.fetch = mock.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/models")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "nvidia/nemotron-3-ultra-550b-a55b:free",
                context_length: 128000,
                top_provider: { max_completion_tokens: 46080 }
              }
            ]
          }),
          { status: 200 }
        );
      }
      return new Response("missing", { status: 404 });
    }) as typeof fetch;
    try {
      const limits = await resolveModelTokenLimits(
        "openai-compatible",
        "nvidia/nemotron-3-ultra-550b-a55b:free"
      );
      assert.equal(limits.contextWindow, 128000);
      assert.equal(limits.maxOutputTokens, 46080);
    } finally {
      if (prev === undefined) delete process.env.CUSTOM_BASE_URL;
      else process.env.CUSTOM_BASE_URL = prev;
    }
  });
});
