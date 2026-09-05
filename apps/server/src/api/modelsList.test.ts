import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { listModelsForProvider } from "./modelsList.js";

async function withClearedCompatibleConfig<T>(
  run: () => Promise<T>
): Promise<T> {
  const keys = [
    "OPENAI_COMPATIBLE_BASE_URL",
    "CUSTOM_BASE_URL",
    "SDLC_LLM_BASE_URL",
    "OLLAMA_BASE_URL"
  ] as const;
  const prevEnv = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];

  const cfgPath = path.join(os.homedir(), ".forge", "config.json");
  let prevFile: string | null = null;
  try {
    prevFile = await fs.readFile(cfgPath, "utf8");
  } catch {
    void 0;
  }
  try {
    if (prevFile != null) {
      const parsed = JSON.parse(prevFile) as {
        llm?: Record<string, unknown>;
        [key: string]: unknown;
      };
      const llm = { ...(parsed.llm ?? {}) };
      delete llm.baseUrl;
      await fs.mkdir(path.dirname(cfgPath), { recursive: true });
      await fs.writeFile(
        cfgPath,
        JSON.stringify({ ...parsed, llm }, null, 2),
        "utf8"
      );
    }
    return await run();
  } finally {
    for (const k of keys) {
      if (prevEnv[k] === undefined) delete process.env[k];
      else process.env[k] = prevEnv[k];
    }
    if (prevFile == null) {
      try {
        await fs.unlink(cfgPath);
      } catch {
        void 0;
      }
    } else {
      await fs.writeFile(cfgPath, prevFile, "utf8");
    }
  }
}

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
    await withClearedCompatibleConfig(async () => {
      const body = await listModelsForProvider("openai-compatible");
      assert.match(body.error ?? "", /OPENAI_COMPATIBLE_BASE_URL/);
    });
  });
});
