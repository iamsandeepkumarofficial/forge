import assert from "node:assert/strict";
import { afterEach, before, describe, it, mock } from "node:test";
import {
  allocateSessionPort,
  resetSessionPortRegistryForTests
} from "./sandboxRuntime/sessionPortRegistry.js";
import {
  rememberSessionExecutionTarget,
  resetSandboxRuntimeCache
} from "./sandboxRuntime/resolve.js";

describe("runtimeActivity", () => {
  let collectRuntimeActivity: typeof import("./runtimeActivity.js").collectRuntimeActivity;

  before(async () => {
    mock.module("../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId() {
            return {
              id: "chat-1",
              sessionId: "sess-a",
              projectId: "proj-1",
              workspaceId: null,
              title: "Demo",
              executionTarget: "local"
            };
          }
        }
      }
    });
    mock.module("./sessionSandbox.js", {
      exports: {
        getSessionSandboxStatus: async () => ({
          status: "ready",
          running: true,
          workingDir: "/workspace"
        }),
        destroySessionSandbox: async () => undefined
      }
    });
    mock.module("./appRunner.js", {
      exports: {
        listAppStatuses: async () => ({
          exists: true,
          source: "launch",
          apps: [
            {
              name: "web",
              running: true,
              url: "http://sess.preview.localhost:8081",
              hostPort: 40001
            }
          ]
        }),
        stopApp: async () => undefined
      }
    });
    mock.module("./sandboxIdle.js", {
      exports: {
        listRunningSandboxSessionIds: async () => []
      }
    });
    ({ collectRuntimeActivity } = await import("./runtimeActivity.js"));
  });

  afterEach(() => {
    resetSandboxRuntimeCache();
    resetSessionPortRegistryForTests();
  });

  it("collectRuntimeActivity includes port registry rows", async () => {
    rememberSessionExecutionTarget("sess-a", "local");
    await allocateSessionPort("sess-a", 40001);
    const activity = await collectRuntimeActivity();
    assert.equal(activity.runtimeKind, "docker");
    assert.ok(activity.ports.some((p) => p.sessionId === "sess-a"));
    assert.ok(activity.sessions.some((s) => s.sessionId === "sess-a"));
    const sess = activity.sessions.find((s) => s.sessionId === "sess-a");
    assert.equal(sess?.runtime, "host");
    assert.ok(activity.apps.some((a) => a.name === "web" && a.running));
  });
});
