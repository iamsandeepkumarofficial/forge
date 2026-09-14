import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("buildPromptContextForSession", () => {
  let buildPromptContextForSession: typeof import("./promptContext.js").buildPromptContextForSession;

  before(async () => {
    mock.module("../services/parameters/resolveSessionEnv.js", {
      exports: {
        resolveSessionEnv: async () => ({
          containerEnv: {},
          byRepo: {},
          envKeyNames: ["DATABASE_URL", "JWT_SECRET"]
        })
      }
    });
    mock.module("../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId(sessionId: string) {
            if (sessionId === "s-ws") {
              return { workspaceId: "ws1", executionTarget: "local" };
            }
            return { workspaceId: null, executionTarget: "local" };
          }
        }
      }
    });
    mock.module("../catalog/workspaceRepository.js", {
      exports: {
        WorkspaceRepository: class {
          async listMembers() {
            return [
              { repoName: "api", dependsOn: [] },
              { repoName: "web", dependsOn: ["api"] }
            ];
          }
        }
      }
    });
    mock.module("../projects/repoInventory.js", {
      exports: {
        loadRepoInventoryFromHost: (opts: {
          members: Array<{ repo: string }>;
        }) => ({
          isWorkspace: opts.members.length > 1,
          members: opts.members.map((m) => ({
            repo: m.repo,
            mountPath: `/workspace/${m.repo}`,
            facts: { analyzable: false }
          })),
          dependsOnGraph: [],
          suggestedSkills: []
        }),
        formatRepoInventoryBlock: () => "## Workspace repos\ninventory"
      }
    });
    ({ buildPromptContextForSession } = await import("./promptContext.js"));
  });

  it("builds workspace prompt context with inventory only (no health/readiness)", async () => {
    const ctx = await buildPromptContextForSession({
      sessionId: "s-ws",
      paths: {
        sessionRoot: "/workspace",
        workingDir: "/workspace",
        repoDir: "root",
        worktrees: { api: "/workspace/api", web: "/workspace/web" },
        hostWorktrees: { api: "/host/api", web: "/host/web" }
      }
    });
    assert.equal(ctx.inventoryBlock, "## Workspace repos\ninventory");
    assert.equal(ctx.executionTarget, "local");
    assert.deepEqual(ctx.envKeyNames, ["DATABASE_URL", "JWT_SECRET"]);
    assert.equal(
      "healthBlock" in ctx && (ctx as { healthBlock?: string }).healthBlock,
      false
    );
  });

  it("builds single-repo inventory when no worktrees", async () => {
    const ctx = await buildPromptContextForSession({
      sessionId: "s-solo",
      paths: {
        sessionRoot: "/workspace",
        workingDir: "/workspace",
        repoDir: "app",
        hostWorkingDir: "/host/app"
      }
    });
    assert.equal(ctx.inventoryBlock, "## Workspace repos\ninventory");
    assert.deepEqual(ctx.envKeyNames, ["DATABASE_URL", "JWT_SECRET"]);
  });
});
