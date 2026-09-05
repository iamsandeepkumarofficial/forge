import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readForgeLlmConfig } from "./forgeLlmConfig.js";

describe("readForgeLlmConfig", () => {
  let tmpHome = "";
  const prevHome = process.env.HOME;

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (tmpHome) {
      await fs.rm(tmpHome, { recursive: true, force: true });
      tmpHome = "";
    }
  });

  async function withTempHome() {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "forge-orch-home-"));
    process.env.HOME = tmpHome;
  }

  it("returns empty object when config is missing or invalid", async () => {
    await withTempHome();
    assert.deepEqual(await readForgeLlmConfig(), {});

    const cfgPath = path.join(tmpHome, ".forge", "config.json");
    await fs.mkdir(path.dirname(cfgPath), { recursive: true });
    await fs.writeFile(cfgPath, "{not-json", "utf8");
    assert.deepEqual(await readForgeLlmConfig(), {});
  });

  it("returns llm section when present", async () => {
    await withTempHome();
    const cfgPath = path.join(tmpHome, ".forge", "config.json");
    await fs.mkdir(path.dirname(cfgPath), { recursive: true });
    await fs.writeFile(
      cfgPath,
      JSON.stringify({
        llm: { provider: "openai-compatible", model: "gpt-test" },
        desktop: { stopComposeOnQuit: true }
      }),
      "utf8"
    );
    assert.deepEqual(await readForgeLlmConfig(), {
      provider: "openai-compatible",
      model: "gpt-test"
    });
  });

  it("returns empty llm when file has no llm key", async () => {
    await withTempHome();
    const cfgPath = path.join(tmpHome, ".forge", "config.json");
    await fs.mkdir(path.dirname(cfgPath), { recursive: true });
    await fs.writeFile(cfgPath, JSON.stringify({ desktop: {} }), "utf8");
    assert.deepEqual(await readForgeLlmConfig(), {});
  });
});
