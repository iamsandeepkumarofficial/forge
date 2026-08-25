import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { REPO_ROOT, env, resolveProvider } from "./env.js";

describe("env", () => {
  it("resolveProvider maps known providers and defaults", () => {
    assert.equal(resolveProvider("anthropic"), "anthropic");
    assert.equal(resolveProvider(" Anthropic "), "anthropic");
    assert.equal(resolveProvider("openai"), "openai");
    assert.equal(resolveProvider("OPENAI"), "openai");
    assert.equal(resolveProvider(undefined), "openai-compatible");
    assert.equal(resolveProvider(""), "openai-compatible");
    assert.equal(resolveProvider("other"), "openai-compatible");
    assert.equal(resolveProvider("custom"), "openai-compatible");
    assert.equal(resolveProvider("ollama"), "openai-compatible");
  });

  it("exports REPO_ROOT as an absolute path", () => {
    assert.equal(path.isAbsolute(REPO_ROOT), true);
    assert.match(REPO_ROOT, /factory\.io$/);
  });

  it("env has defaults and stripped toolRunnerUrl", () => {
    assert.equal(typeof env.temporalAddress, "string");
    assert.ok(env.temporalAddress.length > 0);
    assert.equal(typeof env.temporalNamespace, "string");
    assert.ok(env.temporalNamespace.length > 0);
    assert.equal(typeof env.taskQueue, "string");
    assert.ok(env.taskQueue.length > 0);
    assert.equal(env.toolRunnerUrl.endsWith("/"), false);
    assert.match(env.toolRunnerUrl, /^https?:\/\//);
    assert.ok(
      ["anthropic", "openai", "openai-compatible"].includes(env.llmProvider)
    );
    assert.equal(typeof env.pocToken, "string");
  });
});
