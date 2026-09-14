import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  readForgeConfig,
  readForgeLlmConfig,
  resolveOpenAiCompatibleRuntime,
  writeForgeLlmConfig
} from "./forgeLlmConfig.js";

describe("forgeLlmConfig", () => {
  let tmpHome = "";
  const prevHome = process.env.HOME;
  const prevEnv: Record<string, string | undefined> = {};

  async function withTempHome() {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "forge-home-"));
    process.env.HOME = tmpHome;
  }

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    Object.keys(prevEnv).forEach((k) => delete prevEnv[k]);
    if (tmpHome) {
      await fs.rm(tmpHome, { recursive: true, force: true });
      tmpHome = "";
    }
  });

  function stashEnv(...keys: string[]) {
    for (const k of keys) {
      prevEnv[k] = process.env[k];
      delete process.env[k];
    }
  }

  it("readForgeConfig returns {} when missing", async () => {
    await withTempHome();
    assert.deepEqual(await readForgeConfig(), {});
    assert.deepEqual(await readForgeLlmConfig(), {});
  });

  it("writeForgeLlmConfig merges llm and preserves desktop default", async () => {
    await withTempHome();
    const saved = await writeForgeLlmConfig({
      provider: "openai-compatible",
      model: "m1",
      apiKey: "k1"
    });
    assert.equal(saved.llm?.model, "m1");
    assert.deepEqual(saved.desktop, { stopComposeOnQuit: true });

    const again = await writeForgeLlmConfig({ baseUrl: "http://llm" });
    assert.equal(again.llm?.model, "m1");
    assert.equal(again.llm?.baseUrl, "http://llm");
    assert.equal((await readForgeLlmConfig()).apiKey, "k1");
  });

  it("resolveOpenAiCompatibleRuntime prefers file then env", async () => {
    await withTempHome();
    stashEnv(
      "OPENAI_COMPATIBLE_BASE_URL",
      "CUSTOM_BASE_URL",
      "SDLC_LLM_BASE_URL",
      "OLLAMA_BASE_URL",
      "OPENAI_COMPATIBLE_API_KEY",
      "CUSTOM_API_KEY",
      "SDLC_LLM_API_KEY",
      "OLLAMA_API_KEY",
      "OPENAI_COMPATIBLE_MODEL",
      "CUSTOM_MODEL",
      "SDLC_LLM_MODEL",
      "OLLAMA_MODEL",
      "WORKFLOW_LLM_MODEL"
    );
    process.env.OLLAMA_BASE_URL = "http://env-base";
    process.env.OLLAMA_API_KEY = "env-key";
    process.env.WORKFLOW_LLM_MODEL = "env-model";

    let runtime = await resolveOpenAiCompatibleRuntime();
    assert.deepEqual(runtime, {
      baseUrl: "http://env-base",
      apiKey: "env-key",
      model: "env-model"
    });

    await writeForgeLlmConfig({
      baseUrl: "http://file-base",
      apiKey: "file-key",
      model: "file-model"
    });
    runtime = await resolveOpenAiCompatibleRuntime();
    assert.deepEqual(runtime, {
      baseUrl: "http://file-base",
      apiKey: "file-key",
      model: "file-model"
    });
  });
});
