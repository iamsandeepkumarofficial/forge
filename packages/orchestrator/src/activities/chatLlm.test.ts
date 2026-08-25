import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildLlmProviderOptions,
  buildPlanAwareSystemPrompt,
  extractThoughtSignature,
  formatLlmCallError,
  resolveChatProvider
} from "./chatLlm.js";

describe("chatLlm", () => {
  it("extractThoughtSignature finds nested signature", () => {
    assert.equal(extractThoughtSignature(null), undefined);
    assert.equal(
      extractThoughtSignature({
        google: { thoughtSignature: "sig-1" }
      }),
      "sig-1"
    );
    assert.equal(
      extractThoughtSignature({ google: { thoughtSignature: "" } }),
      undefined
    );
  });

  it("formatLlmCallError flattens nested error fields", () => {
    const msg = formatLlmCallError({
      statusCode: 429,
      message: "rate limited",
      responseBody: "slow down",
      cause: { message: "inner" }
    });
    assert.match(msg, /status=429/);
    assert.match(msg, /rate limited/);
    assert.match(msg, /slow down/);
    assert.match(msg, /inner/);
    assert.equal(formatLlmCallError("plain"), "plain");
  });

  it("resolveChatProvider accepts known providers and defaults", () => {
    assert.equal(resolveChatProvider("openai"), "openai");
    assert.equal(resolveChatProvider("anthropic"), "anthropic");
    assert.equal(resolveChatProvider("openai-compatible"), "openai-compatible");
    assert.equal(resolveChatProvider("custom"), "openai-compatible");
    assert.equal(resolveChatProvider("ollama"), "openai-compatible");
    assert.equal(resolveChatProvider("weird"), "openai-compatible");
  });

  it("buildPlanAwareSystemPrompt appends mode addenda", () => {
    assert.match(buildPlanAwareSystemPrompt("base", "agent"), /Agent mode/);
    assert.match(buildPlanAwareSystemPrompt("base", "plan"), /Plan mode/);
    assert.match(buildPlanAwareSystemPrompt("base", "build"), /Agent mode/);
    assert.match(buildPlanAwareSystemPrompt("base", "ask"), /Ask mode/);
  });

  it("buildLlmProviderOptions maps reasoning effort", () => {
    assert.equal(
      buildLlmProviderOptions({
        provider: "openai-compatible",
        reasoningEffort: "high"
      }),
      undefined
    );
    assert.deepEqual(
      buildLlmProviderOptions({
        provider: "openai",
        reasoningEffort: "medium"
      }),
      { openai: { reasoningEffort: "medium" } }
    );
    assert.deepEqual(
      buildLlmProviderOptions({
        provider: "anthropic",
        reasoningEffort: "low"
      }),
      {
        anthropic: {
          thinking: { type: "enabled", budgetTokens: 2048 }
        }
      }
    );
    assert.equal(buildLlmProviderOptions({ provider: "openai" }), undefined);
  });
});
