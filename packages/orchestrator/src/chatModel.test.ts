import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  coerceChatProvider,
  normalizeOpenAICompatibleBaseUrl,
  resolveChatLanguageModel
} from "./chatModel.js";

describe("chatModel", () => {
  it("normalizeOpenAICompatibleBaseUrl strips slash and adds /v1", () => {
    assert.equal(
      normalizeOpenAICompatibleBaseUrl("http://localhost:11434"),
      "http://localhost:11434/v1"
    );
    assert.equal(
      normalizeOpenAICompatibleBaseUrl("http://localhost:11434/v1/"),
      "http://localhost:11434/v1"
    );
    assert.equal(
      normalizeOpenAICompatibleBaseUrl("http://localhost:11434/v1"),
      "http://localhost:11434/v1"
    );
  });

  it("coerceChatProvider maps legacy custom/ollama to openai-compatible", () => {
    assert.equal(coerceChatProvider("custom"), "openai-compatible");
    assert.equal(coerceChatProvider("ollama"), "openai-compatible");
    assert.equal(coerceChatProvider("openai-compatible"), "openai-compatible");
    assert.equal(coerceChatProvider("anthropic"), "anthropic");
  });

  it("resolveChatLanguageModel requires anthropic key", async () => {
    const prevA = process.env.ANTHROPIC_API_KEY;
    const prevS = process.env.SDLC_LLM_API_KEY;
    const prevW = process.env.WORKFLOW_LLM_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.SDLC_LLM_API_KEY;
    delete process.env.WORKFLOW_LLM_API_KEY;
    try {
      await assert.rejects(
        () => resolveChatLanguageModel("anthropic"),
        /ANTHROPIC_API_KEY/
      );
    } finally {
      if (prevA === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prevA;
      if (prevS === undefined) delete process.env.SDLC_LLM_API_KEY;
      else process.env.SDLC_LLM_API_KEY = prevS;
      if (prevW === undefined) delete process.env.WORKFLOW_LLM_API_KEY;
      else process.env.WORKFLOW_LLM_API_KEY = prevW;
    }
  });

  it("resolveChatLanguageModel requires openai key", async () => {
    const prevO = process.env.OPENAI_API_KEY;
    const prevS = process.env.SDLC_LLM_API_KEY;
    const prevW = process.env.WORKFLOW_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.SDLC_LLM_API_KEY;
    delete process.env.WORKFLOW_LLM_API_KEY;
    try {
      await assert.rejects(
        () => resolveChatLanguageModel("openai"),
        /OPENAI_API_KEY/
      );
    } finally {
      if (prevO === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prevO;
      if (prevS === undefined) delete process.env.SDLC_LLM_API_KEY;
      else process.env.SDLC_LLM_API_KEY = prevS;
      if (prevW === undefined) delete process.env.WORKFLOW_LLM_API_KEY;
      else process.env.WORKFLOW_LLM_API_KEY = prevW;
    }
  });

  it("resolveChatLanguageModel requires openai-compatible base url", async () => {
    const keys = [
      "OPENAI_COMPATIBLE_BASE_URL",
      "CUSTOM_BASE_URL",
      "SDLC_LLM_BASE_URL",
      "OLLAMA_BASE_URL",
      "OPENAI_COMPATIBLE_MODEL",
      "CUSTOM_MODEL",
      "SDLC_LLM_MODEL",
      "OLLAMA_MODEL"
    ] as const;
    const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    for (const k of keys) delete process.env[k];
    try {
      await assert.rejects(
        () => resolveChatLanguageModel("openai-compatible", "m"),
        /OpenAI-compatible base URL|OPENAI_COMPATIBLE_BASE_URL/
      );
      process.env.OPENAI_COMPATIBLE_BASE_URL = "http://127.0.0.1:1234";
      const model = await resolveChatLanguageModel(
        "openai-compatible",
        "local-model"
      );
      assert.ok(model);
      const legacy = await resolveChatLanguageModel("custom", "local-model");
      assert.ok(legacy);
    } finally {
      for (const k of keys) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    }
  });

  it("resolveChatLanguageModel builds anthropic model with key", async () => {
    const prevA = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";
    try {
      const model = await resolveChatLanguageModel(
        "anthropic",
        "claude-3-7-sonnet-latest"
      );
      assert.ok(model);
    } finally {
      if (prevA === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prevA;
    }
  });
});
