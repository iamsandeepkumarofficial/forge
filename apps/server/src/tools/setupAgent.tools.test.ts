import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeProvisionAppEngine } from "./provisionAppEngine.tool.js";
import { phoenixEnabled } from "../services/eval/phoenix.js";
import { formatSetupAgentSopBlock } from "../services/workspace/health/types.js";

describe("setup agent tools and eval", () => {
  it("provision_app_engine rejects without userApproved", async () => {
    const result = await executeProvisionAppEngine({
      sessionId: "sess-test",
      args: { engineId: "postgres", userApproved: false }
    });
    assert.equal(result.success, false);
    assert.match(result.output, /userApproved/);
  });

  it("provision_app_engine rejects missing userApproved", async () => {
    const result = await executeProvisionAppEngine({
      sessionId: "sess-test",
      args: { engineId: "postgres" }
    });
    assert.equal(result.success, false);
  });

  it("phoenix is disabled without collector endpoint", () => {
    const prev =
      process.env.PHOENIX_COLLECTOR_ENDPOINT ??
      process.env.FORGE_PHOENIX_ENDPOINT;
    delete process.env.PHOENIX_COLLECTOR_ENDPOINT;
    delete process.env.FORGE_PHOENIX_ENDPOINT;
    try {
      assert.equal(phoenixEnabled(), false);
    } finally {
      if (prev !== undefined) {
        process.env.PHOENIX_COLLECTOR_ENDPOINT = prev;
      }
    }
  });

  it("setup SOP mentions invoke_skill", () => {
    const block = formatSetupAgentSopBlock({
      preferredSandboxImage: "forge-sandbox-generic:latest"
    });
    assert.match(block, /invoke_skill/);
    assert.match(block, /forge-sandbox-generic:latest/);
  });
});
