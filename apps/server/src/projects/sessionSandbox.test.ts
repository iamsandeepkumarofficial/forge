import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sessionHostPortBase,
  hostPortForContainerPort,
  sessionVolumeName,
  sandboxContainerName,
  FIRST_APP_PORT,
  RESERVED_PORTS,
  DEFAULT_SANDBOX_IMAGE,
  WORKSPACE_MOUNT,
  mountsForSandboxReadyCheck
} from "./sessionSandbox.js";

describe("sessionSandbox helpers", () => {
  it("exposes sandbox constants", () => {
    assert.equal(DEFAULT_SANDBOX_IMAGE, "forge-sandbox:latest");
    assert.equal(WORKSPACE_MOUNT, "/workspace");
    assert.equal(FIRST_APP_PORT, 3000);
    assert.equal(RESERVED_PORTS, 10);
  });

  it("sessionHostPortBase is stable and within reserved blocks", () => {
    const a = sessionHostPortBase("session-abc");
    const b = sessionHostPortBase("session-abc");
    const c = sessionHostPortBase("other-session");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.ok(a >= 40000);
    assert.equal((a - 40000) % RESERVED_PORTS, 0);
  });

  it("hostPortForContainerPort maps reserved app ports only", () => {
    const base = sessionHostPortBase("s1");
    assert.equal(hostPortForContainerPort("s1", FIRST_APP_PORT), base);
    assert.equal(hostPortForContainerPort("s1", FIRST_APP_PORT + 3), base + 3);
    assert.equal(hostPortForContainerPort("s1", FIRST_APP_PORT - 1), null);
    assert.equal(
      hostPortForContainerPort("s1", FIRST_APP_PORT + RESERVED_PORTS),
      null
    );
  });

  it("sanitizes docker volume and container names", () => {
    assert.equal(sessionVolumeName("s1"), "forge-session-s1");
    assert.equal(sandboxContainerName("s1"), "forge-sandbox-s1");
    assert.match(sessionVolumeName("weird/name!here"), /^forge-session-/);
    assert.doesNotMatch(sessionVolumeName("a/b"), /\//);
  });

  it("mountsForSandboxReadyCheck uses member mounts for workspaces", () => {
    assert.deepEqual(mountsForSandboxReadyCheck(undefined), ["/workspace"]);
    assert.deepEqual(mountsForSandboxReadyCheck({}), ["/workspace"]);
    assert.deepEqual(
      mountsForSandboxReadyCheck({ frontend: "/workspace/frontend" }),
      ["/workspace/frontend"]
    );
    assert.deepEqual(
      mountsForSandboxReadyCheck({
        frontend: "/workspace/frontend",
        backend: "/workspace/backend"
      }),
      ["/workspace/frontend", "/workspace/backend"]
    );
  });
});
