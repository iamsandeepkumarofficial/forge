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

  it("materializeLlmEnv falls back to process env for compatible LLM", () => {
    const prev = {
      base: process.env.OPENAI_COMPATIBLE_BASE_URL,
      key: process.env.OPENAI_COMPATIBLE_API_KEY,
      model: process.env.OPENAI_COMPATIBLE_MODEL
    };
    process.env.OPENAI_COMPATIBLE_BASE_URL = "http://env-llm";
    process.env.OPENAI_COMPATIBLE_API_KEY = "env-key";
    process.env.OPENAI_COMPATIBLE_MODEL = "env-model";
    try {
      const env = materializeLlmEnv({
        llm: { provider: "openai-compatible" }
      });
      assert.equal(env.OPENAI_COMPATIBLE_BASE_URL, "http://env-llm");
      assert.equal(env.OPENAI_COMPATIBLE_API_KEY, "env-key");
      assert.equal(env.OPENAI_COMPATIBLE_MODEL, "env-model");
    } finally {
      if (prev.base === undefined)
        delete process.env.OPENAI_COMPATIBLE_BASE_URL;
      else process.env.OPENAI_COMPATIBLE_BASE_URL = prev.base;
      if (prev.key === undefined) delete process.env.OPENAI_COMPATIBLE_API_KEY;
      else process.env.OPENAI_COMPATIBLE_API_KEY = prev.key;
      if (prev.model === undefined) delete process.env.OPENAI_COMPATIBLE_MODEL;
      else process.env.OPENAI_COMPATIBLE_MODEL = prev.model;
    }
  });

  it("applyRepoEnvFile fills missing LLM keys from .env", async () => {
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const { applyRepoEnvFile, parseEnvFile } = await import("./env.js");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "forge-env-"));
    await fs.writeFile(
      path.join(dir, ".env"),
      "OPENAI_COMPATIBLE_BASE_URL=http://from-file\nOPENAI_COMPATIBLE_API_KEY=k\n"
    );
    assert.equal(
      parseEnvFile(path.join(dir, ".env")).OPENAI_COMPATIBLE_BASE_URL,
      "http://from-file"
    );
    const target: NodeJS.ProcessEnv = { OPENAI_COMPATIBLE_API_KEY: "keep" };
    const applied = applyRepoEnvFile(dir, target);
    assert.equal(applied.OPENAI_COMPATIBLE_BASE_URL, "http://from-file");
    assert.equal(target.OPENAI_COMPATIBLE_BASE_URL, "http://from-file");
    assert.equal(target.OPENAI_COMPATIBLE_API_KEY, "keep");
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("materializeHostRuntimeEnv sets host catalog env", async () => {
    const { materializeHostRuntimeEnv } = await import("./env.js");
    const env = materializeHostRuntimeEnv();
    assert.match(env.DATABASE_URL ?? "", /5433/);
    assert.match(env.TEMPORAL_ADDRESS ?? "", /7233/);
    assert.equal(env.SANDBOX_RUNTIME, undefined);
    assert.equal(env.FORGE_DESKTOP, undefined);
  });

  it("mergeEnvExtras lets later parts win", () => {
    const merged = mergeEnvExtras([{ A: "1", B: "2" }, { B: "3" }]);
    assert.deepEqual(merged, { A: "1", B: "3" });
  });
});
