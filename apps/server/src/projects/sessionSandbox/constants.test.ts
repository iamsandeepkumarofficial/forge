import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allocateReservedAppPort,
  sessionHostPortBase,
  hostPortForContainerPort,
  isReservedAppPort,
  sessionVolumeName,
  sandboxContainerName,
  FIRST_APP_PORT,
  LAST_APP_PORT,
  RESERVED_PORTS,
  DEFAULT_SANDBOX_IMAGE,
  WORKSPACE_MOUNT
} from "./constants.js";

describe("sessionSandbox constants", () => {
  it("exposes sandbox constants", () => {
    assert.equal(DEFAULT_SANDBOX_IMAGE, "forge-sandbox:latest");
    assert.equal(WORKSPACE_MOUNT, "/workspace");
    assert.equal(FIRST_APP_PORT, 3000);
    assert.equal(LAST_APP_PORT, 3009);
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

  it("isReservedAppPort and allocateReservedAppPort cover 3000–3009", () => {
    assert.equal(isReservedAppPort(3000), true);
    assert.equal(isReservedAppPort(3009), true);
    assert.equal(isReservedAppPort(4000), false);
    assert.equal(allocateReservedAppPort([]), 3000);
    assert.equal(allocateReservedAppPort([3000, 3001]), 3002);
    assert.equal(
      allocateReservedAppPort([3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009]),
      null
    );
  });

  it("sanitizes docker volume and container names", () => {
    assert.equal(sessionVolumeName("s1"), "forge-session-s1");
    assert.equal(sandboxContainerName("s1"), "forge-sandbox-s1");
    assert.match(sessionVolumeName("weird/name!here"), /^forge-session-/);
    assert.doesNotMatch(sessionVolumeName("a/b"), /\//);
  });
});
