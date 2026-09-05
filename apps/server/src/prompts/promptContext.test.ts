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
    mock.module("../projects/appRunner.js", {
      exports: {
        readForgeConfig: async () => ({
          exists: true,
          source: "session",
          config: {
            apps: [{ name: "web", repo: "web", port: 3000 }]
          }
        })
      }
    });
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
    mock.module("../catalog/workspaceHealthRepository.js", {
      exports: {
        WorkspaceHealthRepository: class {
          async get() {
            return {
              report: {
                status: "warnings",
                computedAt: "2026-01-01T00:00:00.000Z",
                members: [],
                findings: [
                  {
                    code: "missing-env-key",
                    severity: "warning",
                    message: "JWT_SECRET missing"
                  }
                ],
                dependsOnGraph: [],
                shadows: {
                  preferredSandboxImage: "forge-sandbox:latest"
                }
              }
            };
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
    mock.module("../services/workspace/health/types.js", {
      exports: {
        formatHealthPromptBlock: () => "## Health\nwarnings",
        formatSetupAgentSopBlock: (opts?: { preferredSandboxImage?: string }) =>
          `SOP image=${opts?.preferredSandboxImage ?? "default"}`
      }
    });
    mock.module("./repoReadiness.js", {
      exports: {
        readinessFromForgeApps: () => ({
          readyRepos: ["web"],
          pendingRepos: ["api"]
        })
      }
    });
    ({ buildPromptContextForSession } = await import("./promptContext.js"));
  });

  it("builds workspace prompt context with inventory, health, readiness", async () => {
    const ctx = await buildPromptContextForSession({
      sessionId: "s-ws",
      paths: {
        workingDir: "/workspace",
        repoDir: "root",
        worktrees: { api: "/workspace/api", web: "/workspace/web" },
        hostWorktrees: { api: "/host/api", web: "/host/web" }
      }
    });
    assert.equal(ctx.inventoryBlock, "## Workspace repos\ninventory");
    assert.equal(ctx.healthBlock, "## Health\nwarnings");
    assert.match(ctx.setupSopBlock ?? "", /forge-sandbox:latest/);
    assert.deepEqual(ctx.envKeyNames, ["DATABASE_URL", "JWT_SECRET"]);
    assert.deepEqual(ctx.readiness, {
      readyRepos: ["web"],
      pendingRepos: ["api"]
    });
  });

  it("builds single-repo inventory when no worktrees", async () => {
    const ctx = await buildPromptContextForSession({
      sessionId: "s-solo",
      paths: {
        workingDir: "/workspace",
        repoDir: "app",
        hostWorkingDir: "/host/app"
      }
    });
    assert.equal(ctx.inventoryBlock, "## Workspace repos\ninventory");
    assert.equal(ctx.healthBlock, "");
    assert.equal(ctx.setupSopBlock, undefined);
    assert.equal(ctx.readiness, undefined);
  });
});
