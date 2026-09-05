import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("workspaceSession", () => {
  let loadWorkspaceSessionContext: typeof import("./workspaceSession.js").loadWorkspaceSessionContext;

  before(async () => {
    mock.module("../../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId(sessionId: string) {
            if (sessionId === "s-ws") return { id: "c1", workspaceId: "ws1" };
            if (sessionId === "s-no-ws") return { id: "c2", workspaceId: null };
            return null;
          }
        }
      }
    });
    mock.module("../../catalog/workspaceRepository.js", {
      exports: {
        WorkspaceRepository: class {
          async getById(id: string) {
            if (id !== "ws1") return null;
            return {
              id: "ws1",
              name: "Demo",
              routes: [{ path: "/api", target: "api" }]
            };
          }
          async listMembers(workspaceId: string) {
            return workspaceId === "ws1"
              ? [{ projectId: "p1", repoName: "api", dependsOn: [] }]
              : [];
          }
        }
      }
    });
    ({ loadWorkspaceSessionContext } = await import("./workspaceSession.js"));
  });

  it("returns null for unknown or non-workspace sessions", async () => {
    assert.equal(await loadWorkspaceSessionContext("missing"), null);
    assert.equal(await loadWorkspaceSessionContext("s-no-ws"), null);
  });

  it("loads workspace, members, and routes", async () => {
    const ctx = await loadWorkspaceSessionContext("s-ws");
    assert.ok(ctx);
    assert.equal(ctx.workspaceId, "ws1");
    assert.equal(ctx.workspace.name, "Demo");
    assert.equal(ctx.members.length, 1);
    assert.equal(ctx.members[0]!.repoName, "api");
    assert.deepEqual(ctx.routes, [{ path: "/api", target: "api" }]);
  });
});
