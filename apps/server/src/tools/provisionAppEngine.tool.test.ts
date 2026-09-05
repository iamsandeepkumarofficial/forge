import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("executeProvisionAppEngine", () => {
  let executeProvisionAppEngine: typeof import("./provisionAppEngine.tool.js").executeProvisionAppEngine;
  let attachShouldFail = false;

  before(async () => {
    mock.module("../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId(sessionId: string) {
            if (sessionId === "s-ws") return { workspaceId: "ws1" };
            return { workspaceId: null };
          }
        }
      }
    });
    mock.module("../projects/sessionAppDb.js", {
      exports: {
        getAppDbEngine: (id: string) =>
          id === "postgres" || id === "mongo" ? { id, label: id } : null,
        attachWorkspaceDatabase: async (_ws: string, engineId: string) => {
          if (attachShouldFail) throw new Error("docker down");
          return {
            label: engineId,
            image: `${engineId}:latest`,
            database: "forge_ws_demo",
            envKey: engineId === "mongo" ? "MONGODB_URI" : "DATABASE_URL"
          };
        }
      }
    });
    mock.module("../services/eval/phoenix.js", {
      exports: {
        emitSetupAgentEval: async () => undefined
      }
    });
    ({ executeProvisionAppEngine } =
      await import("./provisionAppEngine.tool.js"));
  });

  it("requires userApproved", async () => {
    const r = await executeProvisionAppEngine({
      sessionId: "s-ws",
      args: { engineId: "postgres" }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /userApproved/);
  });

  it("rejects invalid engineId", async () => {
    const r = await executeProvisionAppEngine({
      sessionId: "s-ws",
      args: { engineId: "redis", userApproved: true }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /postgres.*mongo/i);
  });

  it("requires workspace session", async () => {
    const r = await executeProvisionAppEngine({
      sessionId: "s-other",
      args: { engineId: "postgres", userApproved: true }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /workspace sessions/);
  });

  it("provisions on success and surfaces attach failures", async () => {
    attachShouldFail = false;
    const ok = await executeProvisionAppEngine({
      sessionId: "s-ws",
      args: { engineId: "Postgres", userApproved: true }
    });
    assert.equal(ok.success, true);
    assert.equal(ok.metadata?.engineId, "postgres");
    assert.match(ok.output, /Provisioned/);

    attachShouldFail = true;
    const fail = await executeProvisionAppEngine({
      sessionId: "s-ws",
      args: { engineId: "mongo", userApproved: true }
    });
    assert.equal(fail.success, false);
    assert.match(fail.output, /docker down/);
  });
});
