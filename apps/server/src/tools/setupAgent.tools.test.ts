import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeSetupProjectInfra } from "./setupProjectInfra.tool.js";
import { phoenixEnabled } from "../services/eval/phoenix.js";
import { formatSetupAgentSopBlock } from "../services/workspace/health/types.js";

describe("setup agent tools and eval", () => {
  it("setup_project_infra rejects without userApproved", async () => {
    const result = await executeSetupProjectInfra({
      sessionId: "sess-test",
      args: { engineId: "postgres", userApproved: false }
    });
    assert.equal(result.success, false);
    assert.match(result.output, /userApproved/);
  });

  it("setup_project_infra rejects missing userApproved", async () => {
    const result = await executeSetupProjectInfra({
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

  it("setup SOP mentions invoke_skill and install_project_infra", () => {
    const block = formatSetupAgentSopBlock({
      preferredSandboxImage: "forge-sandbox-generic:latest"
    });
    assert.match(block, /invoke_skill/);
    assert.match(block, /forge-sandbox-generic:latest/);
    assert.match(block, /ask_user/);
    assert.match(block, /install_project_infra/);
    assert.match(block, /setup_project_infra/);
  });
});
