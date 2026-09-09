import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("executeSetupProjectInfra", () => {
  let executeSetupProjectInfra: typeof import("./setupProjectInfra.tool.js").executeSetupProjectInfra;
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
        attachWorkspaceDatabase: async (options: {
          workspaceId: string;
          engineId: string;
        }) => {
          if (attachShouldFail) throw new Error("docker down");
          const { engineId } = options;
          return {
            label: engineId,
            engineId,
            image: `${engineId}:latest`,
            database: "forge_ws_demo",
            envKey: engineId === "mongo" ? "MONGODB_URI" : "DATABASE_URL",
            containerName: `c-${engineId}`,
            reused: false,
            pulled: false,
            hostPort: 27017
          };
        }
      }
    });
    mock.module("../services/eval/phoenix.js", {
      exports: {
        emitSetupAgentEval: async () => undefined
      }
    });
    ({ executeSetupProjectInfra } =
      await import("./setupProjectInfra.tool.js"));
  });

  it("requires userApproved", async () => {
    const r = await executeSetupProjectInfra({
      sessionId: "s-ws",
      args: { engineId: "postgres" }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /userApproved/);
  });

  it("rejects invalid engineId", async () => {
    const r = await executeSetupProjectInfra({
      sessionId: "s-ws",
      args: { engineId: "redis", userApproved: true }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /postgres.*mongo/i);
  });

  it("requires workspace session", async () => {
    const r = await executeSetupProjectInfra({
      sessionId: "s-other",
      args: { engineId: "postgres", userApproved: true }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /workspace sessions/);
  });

  it("sets up on success and surfaces attach failures", async () => {
    attachShouldFail = false;
    const ok = await executeSetupProjectInfra({
      sessionId: "s-ws",
      args: { engineId: "Postgres", userApproved: true }
    });
    assert.equal(ok.success, true);
    assert.equal(ok.metadata?.engineId, "postgres");
    assert.match(ok.output, /Set up/);

    attachShouldFail = true;
    const fail = await executeSetupProjectInfra({
      sessionId: "s-ws",
      args: { engineId: "mongo", userApproved: true }
    });
    assert.equal(fail.success, false);
    assert.match(fail.output, /docker down/);
    assert.match(fail.output, /install_project_infra/);
  });
});
