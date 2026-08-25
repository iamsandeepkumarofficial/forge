import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  createK8sSandboxRuntime,
  sandboxResourceName,
  type K8sWorkspaceClient
} from "./k8sAdapter.js";
import { SandboxRuntimeError } from "./types.js";

describe("k8sAdapter", () => {
  it("creates a kubernetes workspace handle", async () => {
    const createWorkspace = mock.fn(async (input: { sessionId: string }) => ({
      podName: sandboxResourceName(input.sessionId),
      serviceName: sandboxResourceName(input.sessionId)
    }));
    const exec = mock.fn(async () => ({ code: 0, stdout: "ok\n", stderr: "" }));
    const destroyWorkspace = mock.fn(async () => undefined);
    const client: K8sWorkspaceClient = {
      namespace: "forge",
      createWorkspace,
      exec,
      destroyWorkspace
    };
    const rt = createK8sSandboxRuntime(client);
    const handle = await rt.createSession("sess1");
    assert.equal(handle.runtime, "kubernetes");
    assert.equal(handle.ref, sandboxResourceName("sess1"));
    assert.equal(createWorkspace.mock.callCount(), 1);
    const result = await rt.exec({ handle, cmd: ["ls", "/workspace"] });
    assert.equal(result.code, 0);
    assert.equal(exec.mock.callCount(), 1);
    await rt.destroySession("sess1");
    assert.equal(destroyWorkspace.mock.callCount(), 1);
  });

  it("wraps create failures as workspace_unavailable", async () => {
    const client: K8sWorkspaceClient = {
      namespace: "forge",
      createWorkspace: mock.fn(async () => {
        throw new Error("no schedule");
      }),
      exec: mock.fn(async () => ({ code: 0, stdout: "", stderr: "" })),
      destroyWorkspace: mock.fn(async () => undefined)
    };
    const rt = createK8sSandboxRuntime(client);
    await assert.rejects(
      () => rt.createSession("sess1"),
      (err: unknown) =>
        err instanceof SandboxRuntimeError &&
        err.code === "workspace_unavailable"
    );
  });
});
