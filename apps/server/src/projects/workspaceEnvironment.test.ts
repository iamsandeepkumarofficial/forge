import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("workspaceEnvironment", { concurrency: false }, () => {
  let chatWorkspaceId: string | null = "ws-1";
  let savedLaunch: { apps: Array<Record<string, unknown>> } | null = null;
  let upserted: {
    workspaceId: string;
    launch: unknown;
    sourceSessionId: string | null;
  } | null = null;
  let written: unknown = null;
  let forgeConfig = { exists: true, config: { apps: [] as unknown[] } };
  let members: Array<{ repoName: string }> = [{ repoName: "frontend" }];
  let restored: string[] = [];
  let captured: string[] = [];

  let seedLaunchFromWorkspace: typeof import("./workspaceEnvironment.js").seedLaunchFromWorkspace;
  let promoteLaunchToWorkspace: typeof import("./workspaceEnvironment.js").promoteLaunchToWorkspace;
  let restoreWorkspaceDepsForSession: typeof import("./workspaceEnvironment.js").restoreWorkspaceDepsForSession;
  let captureWorkspaceDepsForSession: typeof import("./workspaceEnvironment.js").captureWorkspaceDepsForSession;
  let getWorkspaceEnvironmentStatus: typeof import("./workspaceEnvironment.js").getWorkspaceEnvironmentStatus;

  before(async () => {
    mock.module("../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId() {
            return chatWorkspaceId
              ? { workspaceId: chatWorkspaceId, sessionId: "sess-1" }
              : { workspaceId: null, sessionId: "sess-1" };
          }
        }
      }
    });
    mock.module("../catalog/workspaceEnvironmentRepository.js", {
      exports: {
        WorkspaceEnvironmentRepository: class {
          async get() {
            if (!savedLaunch) return null;
            return {
              workspaceId: "ws-1",
              launch: savedLaunch,
              sourceSessionId: "old-sess",
              updatedAt: new Date("2024-01-01T00:00:00.000Z")
            };
          }
          async upsertLaunch(
            workspaceId: string,
            launch: unknown,
            sourceSessionId: string | null
          ) {
            upserted = { workspaceId, launch, sourceSessionId };
          }
          async clearLaunch() {}
        }
      }
    });
    mock.module("../catalog/workspaceRepository.js", {
      exports: {
        WorkspaceRepository: class {
          async listMembers() {
            return members;
          }
        }
      }
    });
    mock.module("./appRunner.js", {
      exports: {
        readForgeConfig: async () => forgeConfig,
        writeForgeConfig: async (_s: string, config: unknown) => {
          written = config;
        }
      }
    });
    mock.module("./sandboxExec.js", {
      exports: {
        resolveSandbox: async () => ({ containerName: "c1" })
      }
    });
    mock.module("./workspaceDepsCache.js", {
      exports: {
        restoreCachedDeps: async (opts: { repoName: string }) => {
          restored.push(opts.repoName);
          return true;
        },
        captureCachedDeps: async (opts: { repoName: string }) => {
          captured.push(opts.repoName);
          return true;
        },
        clearWorkspaceDepsCache: async () => undefined,
        workspaceDepsVolumeName: (id: string) => `forge-ws-deps-${id.slice(0, 8)}`
      }
    });

    ({
      seedLaunchFromWorkspace,
      promoteLaunchToWorkspace,
      restoreWorkspaceDepsForSession,
      captureWorkspaceDepsForSession,
      getWorkspaceEnvironmentStatus
    } = await import("./workspaceEnvironment.js"));
  });

  it("seeds launch from workspace catalog", async () => {
    chatWorkspaceId = "ws-1";
    savedLaunch = {
      apps: [
        {
          name: "web",
          cwd: "frontend",
          command: "yarn dev",
          type: "web",
          port: 3000,
          repo: "frontend"
        }
      ]
    };
    written = null;
    const ok = await seedLaunchFromWorkspace("sess-1");
    assert.equal(ok, true);
    assert.deepEqual(written, {
      apps: [
        {
          name: "web",
          cwd: "frontend",
          command: "yarn dev",
          type: "web",
          port: 3000,
          repo: "frontend"
        }
      ]
    });
  });

  it("does not seed without workspace", async () => {
    chatWorkspaceId = null;
    savedLaunch = { apps: [{ name: "x", cwd: ".", command: "npm run dev", type: "web" }] };
    written = null;
    assert.equal(await seedLaunchFromWorkspace("sess-1"), false);
    assert.equal(written, null);
  });

  it("promotes session launch after successful env", async () => {
    chatWorkspaceId = "ws-1";
    upserted = null;
    forgeConfig = {
      exists: true,
      config: {
        apps: [
          {
            name: "api",
            cwd: "backend",
            command: "npm run start",
            type: "api",
            port: 3001,
            repo: "backend"
          }
        ]
      }
    };
    await promoteLaunchToWorkspace("sess-1");
    assert.deepEqual(upserted, {
      workspaceId: "ws-1",
      launch: forgeConfig.config,
      sourceSessionId: "sess-1"
    });
  });

  it("restores and captures deps per member", async () => {
    chatWorkspaceId = "ws-1";
    members = [{ repoName: "frontend" }, { repoName: "backend" }];
    restored = [];
    captured = [];
    await restoreWorkspaceDepsForSession("sess-1");
    await captureWorkspaceDepsForSession("sess-1");
    assert.deepEqual(restored, ["frontend", "backend"]);
    assert.deepEqual(captured, ["frontend", "backend"]);
  });

  it("returns environment status for settings", async () => {
    chatWorkspaceId = "ws-1";
    savedLaunch = {
      apps: [{ name: "web", cwd: ".", command: "yarn dev", type: "web" }]
    };
    const status = await getWorkspaceEnvironmentStatus("ws-1");
    assert.equal(status.depsVolumeName, "forge-ws-deps-ws-1");
    assert.equal(status.launch.apps.length, 1);
    assert.equal(status.sourceSessionId, "old-sess");
  });
});
