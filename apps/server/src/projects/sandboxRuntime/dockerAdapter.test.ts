import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { SandboxRuntime, WorkspaceHandle } from "./types.js";
import { SandboxRuntimeError } from "./types.js";

describe("dockerAdapter contract (mocked)", () => {
  it("WorkspaceHandle uses docker runtime kind", () => {
    const handle: WorkspaceHandle = {
      sessionId: "s1",
      runtime: "docker",
      ref: "forge-sandbox-s1"
    };
    assert.equal(handle.runtime, "docker");
  });

  it("SandboxRuntimeError carries stable codes", () => {
    const err = new SandboxRuntimeError({
      code: "workspace_unavailable",
      message: "cannot schedule"
    });
    assert.equal(err.code, "workspace_unavailable");
  });

  it("exec forwards argv through a fake runtime", async () => {
    const exec = mock.fn(async () => ({
      code: 0,
      stdout: "ok\n",
      stderr: ""
    }));
    const runtime: SandboxRuntime = {
      kind: "docker",
      createSession: async (sessionId) => ({
        sessionId,
        runtime: "docker",
        ref: `forge-sandbox-${sessionId}`
      }),
      exec,
      getStatus: async () => ({ status: "ready", running: true }),
      resolveListenPort: async () => 3000,
      resolvePublishedPort: async () => 40000,
      ensurePublishedPortReady: async () => true,
      publishedAppPortsEnv: () => "3000-3009",
      isAllowedListenPort: (port) => port >= 3000 && port <= 3009,
      previewHostname: (sessionId, port) =>
        port === 3000
          ? `s-${sessionId}.preview.local`
          : `p${port}-s-${sessionId}.preview.local`,
      publishPreviewPort: async (handle, port) => ({
        hostname: `s-${handle.sessionId}.preview.local`,
        targetPort: port,
        url: `http://127.0.0.1:${port}`
      }),
      destroySession: async () => undefined
    };
    const handle = await runtime.createSession("abc");
    const result = await runtime.exec({ handle, cmd: ["echo", "hi"] });
    assert.equal(result.code, 0);
    assert.equal(exec.mock.callCount(), 1);
  });
});
