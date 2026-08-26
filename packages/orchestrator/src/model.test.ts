import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveModel, resolveModelConfig } from "./model.js";

describe("model", () => {
  it("resolveModelConfig uses agent override and source agent", () => {
    const config = resolveModelConfig({
      provider: "openai",
      name: "gpt-4o",
      baseUrl: "https://example.test/v1"
    });
    assert.deepEqual(config, {
      provider: "openai",
      name: "gpt-4o",
      baseUrl: "https://example.test/v1",
      source: "agent"
    });
  });

  it("resolveModelConfig defaults anthropic model name", () => {
    const config = resolveModelConfig({ provider: "anthropic" });
    assert.equal(config.provider, "anthropic");
    assert.equal(config.name, "claude-3-7-sonnet-latest");
    assert.equal(config.source, "agent");
  });

  it("resolveModelConfig defaults openai model name", () => {
    const config = resolveModelConfig({ provider: "openai" });
    assert.equal(config.provider, "openai");
    assert.equal(config.name, "gpt-4o-mini");
  });

  it("resolveModel throws without anthropic key", async () => {
    const prevApi = process.env.SDLC_LLM_API_KEY;
    const prevAnth = process.env.ANTHROPIC_API_KEY;
    delete process.env.SDLC_LLM_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await assert.rejects(
        () =>
          resolveModel({
            provider: "anthropic",
            name: "claude-3-7-sonnet-latest"
          }),
        /ANTHROPIC_API_KEY/
      );
    } finally {
      if (prevApi === undefined) delete process.env.SDLC_LLM_API_KEY;
      else process.env.SDLC_LLM_API_KEY = prevApi;
      if (prevAnth === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prevAnth;
    }
  });

  it("resolveModel throws without openai key", async () => {
    const prevApi = process.env.SDLC_LLM_API_KEY;
    const prevOpen = process.env.OPENAI_API_KEY;
    delete process.env.SDLC_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await assert.rejects(
        () => resolveModel({ provider: "openai", name: "gpt-4o-mini" }),
        /OPENAI_API_KEY/
      );
    } finally {
      if (prevApi === undefined) delete process.env.SDLC_LLM_API_KEY;
      else process.env.SDLC_LLM_API_KEY = prevApi;
      if (prevOpen === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prevOpen;
    }
  });

  it("resolveModel throws without baseUrl for openai-compatible", async () => {
    const keys = [
      "OPENAI_COMPATIBLE_BASE_URL",
      "CUSTOM_BASE_URL",
      "SDLC_LLM_BASE_URL",
      "OLLAMA_BASE_URL"
    ] as const;
    const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    for (const k of keys) delete process.env[k];
    try {
      await assert.rejects(
        () =>
          resolveModel({
            provider: "openai-compatible",
            name: "llama3",
            baseUrl: undefined
          }),
        /OpenAI-compatible base URL|OPENAI_COMPATIBLE_BASE_URL/
      );
    } finally {
      for (const k of keys) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    }
  });

  it("resolveModel builds openai-compatible client with baseUrl", async () => {
    const model = await resolveModel({
      provider: "openai-compatible",
      name: "llama3",
      baseUrl: "http://127.0.0.1:11434/v1/"
    });
    assert.ok(model);
    assert.equal(typeof model, "object");
  });
});
