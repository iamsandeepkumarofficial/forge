import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  emitSetupAgentEval,
  emitSetupPrepareEval,
  phoenixEnabled
} from "./phoenix.js";

describe("phoenix", () => {
  const prevCollector = process.env.PHOENIX_COLLECTOR_ENDPOINT;
  const prevForge = process.env.FORGE_PHOENIX_ENDPOINT;

  afterEach(() => {
    if (prevCollector === undefined)
      delete process.env.PHOENIX_COLLECTOR_ENDPOINT;
    else process.env.PHOENIX_COLLECTOR_ENDPOINT = prevCollector;
    if (prevForge === undefined) delete process.env.FORGE_PHOENIX_ENDPOINT;
    else process.env.FORGE_PHOENIX_ENDPOINT = prevForge;
  });

  it("phoenixEnabled reflects collector env", () => {
    delete process.env.PHOENIX_COLLECTOR_ENDPOINT;
    delete process.env.FORGE_PHOENIX_ENDPOINT;
    assert.equal(phoenixEnabled(), false);

    process.env.FORGE_PHOENIX_ENDPOINT = "http://localhost:6006/";
    assert.equal(phoenixEnabled(), true);

    delete process.env.FORGE_PHOENIX_ENDPOINT;
    process.env.PHOENIX_COLLECTOR_ENDPOINT = "http://phoenix/v1/traces";
    assert.equal(phoenixEnabled(), true);
  });

  it("emit helpers no-op when collector is unset", async () => {
    delete process.env.PHOENIX_COLLECTOR_ENDPOINT;
    delete process.env.FORGE_PHOENIX_ENDPOINT;
    await emitSetupPrepareEval({
      workspaceId: "ws1",
      status: "ok",
      findingCodes: ["no-members"],
      shadows: {
        ecosystemEvidence: [],
        paramCandidates: [
          { key: "JWT_SECRET", secretLikely: true, repo: "api" }
        ],
        infraEvidence: ["postgres"],
        preferredSandboxImage: "forge-sandbox:latest"
      }
    });
    await emitSetupAgentEval({
      sessionId: "s1",
      workspaceId: "ws1",
      paramsUpserted: ["JWT_SECRET"],
      infraProvisioned: ["postgres"]
    });
  });
});
