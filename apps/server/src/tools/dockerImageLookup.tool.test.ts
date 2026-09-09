import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeDockerImageLookup } from "./dockerImageLookup.tool.js";
import {
  DEFAULT_SANDBOX_IMAGE,
  GENERIC_SANDBOX_IMAGE
} from "../projects/sessionSandbox/constants.js";
import {
  rememberSessionExecutionTarget,
  resetSandboxRuntimeCache
} from "../projects/sandboxRuntime/resolve.js";

describe("executeDockerImageLookup", () => {
  afterEach(() => {
    resetSandboxRuntimeCache();
  });

  it("returns unavailable in host mode", async () => {
    rememberSessionExecutionTarget("sess-host", "local");
    const r = await executeDockerImageLookup({
      sessionId: "sess-host",
      args: {}
    });
    assert.equal(r.success, false);
    assert.match(r.output, /unavailable in host mode/);
  });

  it("returns known engine details by engineId", async () => {
    rememberSessionExecutionTarget("sess-cloud", "cloud");
    const r = await executeDockerImageLookup({
      sessionId: "sess-cloud",
      args: { engineId: "postgres" }
    });
    assert.equal(r.success, true);
    assert.match(r.output, /image:/);
    assert.match(r.output, /envKey:/);
    assert.equal(r.metadata?.engineId, "postgres");
  });

  it("rejects unknown engineId", async () => {
    const r = await executeDockerImageLookup({
      args: { engineId: "redis" }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /Unknown engineId/);
  });

  it("lists sandbox and app-db images without a query", async () => {
    const r = await executeDockerImageLookup({ args: {} });
    assert.equal(r.success, true);
    assert.match(r.output, new RegExp(DEFAULT_SANDBOX_IMAGE));
    assert.match(r.output, new RegExp(GENERIC_SANDBOX_IMAGE));
    assert.match(r.output, /postgres/);
    const images = r.metadata?.images as unknown[];
    assert.ok(Array.isArray(images) && images.length >= 3);
  });

  it("filters by query and fails when nothing matches", async () => {
    const hit = await executeDockerImageLookup({
      args: { query: "mongo" }
    });
    assert.equal(hit.success, true);
    assert.match(hit.output, /mongo/);

    const miss = await executeDockerImageLookup({
      args: { query: "definitely-not-an-image-xyz" }
    });
    assert.equal(miss.success, false);
    assert.match(miss.output, /No images matched/);
  });
});
