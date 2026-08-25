import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { listModelsForProvider } from "./modelsList.js";

describe("listModelsForProvider", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns anthropic fallbacks without fetch", async () => {
    const body = await listModelsForProvider("anthropic");
    assert.equal(body.object, "list");
    assert.ok(body.data.length >= 3);
    assert.ok(body.data.some((m) => m.id.includes("claude")));
  });

  it("errors when OPENAI_API_KEY missing", async () => {
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

  it("errors when OPENAI_COMPATIBLE_BASE_URL missing", async () => {
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
});
