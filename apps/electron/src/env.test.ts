import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultConfig,
  materializeLlmEnv,
  materializePreviewEnv,
  mergeEnvExtras
} from "./env.js";

describe("env", () => {
  it("defaultConfig sets stopComposeOnQuit true", () => {
    assert.equal(defaultConfig().desktop?.stopComposeOnQuit, true);
  });

  it("materializePreviewEnv sets in-process preview.localhost", () => {
    const env = materializePreviewEnv();
    assert.equal(env.PREVIEW_IN_PROCESS, "1");
    assert.equal(env.FORGE_PREVIEW_BASE_DOMAIN, "preview.localhost");
    assert.equal(env.PREVIEW_PLANE_URL, "http://127.0.0.1:8081");
  });

  it("materializeLlmEnv maps named provider keys", () => {
    const env = materializeLlmEnv({
      llm: { openaiApiKey: "o", anthropicApiKey: "a" }
    });
    assert.equal(env.OPENAI_API_KEY, "o");
    assert.equal(env.ANTHROPIC_API_KEY, "a");
  });

  it("materializeLlmEnv maps generic key by provider", () => {
    assert.equal(
      materializeLlmEnv({ llm: { apiKey: "k", provider: "anthropic" } })
        .ANTHROPIC_API_KEY,
      "k"
    );
    assert.equal(
      materializeLlmEnv({ llm: { apiKey: "k", provider: "openai" } })
        .OPENAI_API_KEY,
      "k"
    );
    assert.equal(
      materializeLlmEnv({ llm: { apiKey: "k", provider: "other" } })
        .OPENAI_COMPATIBLE_API_KEY,
      "k"
    );
  });

  it("materializeLlmEnv maps model and baseUrl", () => {
    const env = materializeLlmEnv({
      llm: { model: "m", baseUrl: "http://llm" }
    });
    assert.equal(env.OPENAI_COMPATIBLE_MODEL, "m");
    assert.equal(env.WORKFLOW_LLM_MODEL, "m");
    assert.equal(env.OPENAI_COMPATIBLE_BASE_URL, "http://llm");
  });

  it("mergeEnvExtras lets later parts win", () => {
    const merged = mergeEnvExtras([{ A: "1", B: "2" }, { B: "3" }]);
    assert.deepEqual(merged, { A: "1", B: "3" });
  });
});
