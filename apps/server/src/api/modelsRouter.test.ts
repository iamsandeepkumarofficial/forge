import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  listModelsForProvider,
  handleModelsList,
  handleModelContextWindow
} from "./modelsRouter.js";

function mockRes() {
  const state: {
    statusCode: number;
    body: unknown;
  } = { statusCode: 200, body: null };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    }
  };
  return { res: res as never, state };
}

describe("modelsRouter helpers", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restoreAll();
  });

  it("listModelsForProvider returns anthropic fallbacks without fetch", async () => {
    const body = await listModelsForProvider("anthropic");
    assert.equal(body.object, "list");
    assert.ok(body.data.length >= 3);
    assert.ok(body.data.some((m) => m.id.includes("claude")));
  });

  it("listModelsForProvider errors when OPENAI_API_KEY missing", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const body = await listModelsForProvider("openai");
      assert.equal(body.data.length, 0);
      assert.match(body.error ?? "", /OPENAI_API_KEY/);
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });

  it("listModelsForProvider errors when OPENAI_COMPATIBLE_BASE_URL missing", async () => {
    const keys = [
      "OPENAI_COMPATIBLE_BASE_URL",
      "CUSTOM_BASE_URL",
      "SDLC_LLM_BASE_URL",
      "OLLAMA_BASE_URL"
    ] as const;
    const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    for (const k of keys) delete process.env[k];
    try {
      const body = await listModelsForProvider("openai-compatible");
      assert.match(body.error ?? "", /OPENAI_COMPATIBLE_BASE_URL/);
    } finally {
      for (const k of keys) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    }
  });

  it("handleModelsList returns 502 when provider list has only an error", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { res, state } = mockRes();
    try {
      await handleModelsList({ query: { provider: "openai" } } as never, res);
      assert.equal(state.statusCode, 502);
      assert.equal((state.body as { data: unknown[] }).data.length, 0);
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });

  it("handleModelContextWindow requires model query", async () => {
    const { res, state } = mockRes();
    await handleModelContextWindow(
      { query: { provider: "openai" } } as never,
      res
    );
    assert.equal(state.statusCode, 400);
    assert.deepEqual(state.body, { error: "model query required" });
  });

  it("handleModelContextWindow resolves openai table models", async () => {
    const { res, state } = mockRes();
    await handleModelContextWindow(
      { query: { provider: "openai", model: "gpt-4o" } } as never,
      res
    );
    assert.equal(state.statusCode, 200);
    const body = state.body as {
      contextWindow: number;
      maxOutputTokens: number | null;
      source: string;
    };
    assert.equal(body.contextWindow, 128000);
    assert.equal(body.maxOutputTokens, null);
    assert.equal(body.source, "resolved");
  });
});
