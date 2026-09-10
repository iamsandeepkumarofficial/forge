import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  resolveCloudListenPort,
  resolveDockerPublishedPort,
  cloudPublishedAppPortsEnv
} from "./sandboxRuntime/cloudPorts.js";
import { createDockerSandboxRuntime } from "./sandboxRuntime/dockerAdapter.js";
import { createHostSandboxRuntime } from "./sandboxRuntime/hostAdapter.js";
import {
  HOST_PORT_CEILING,
  HOST_PORT_FLOOR,
  hostPublishedAppPortsEnv,
  portsForSession,
  releaseSessionPorts,
  resetSessionPortRegistryForTests
} from "./sandboxRuntime/sessionPortRegistry.js";
import {
  FIRST_APP_PORT,
  hostPortForContainerPort
} from "./sessionSandbox/constants.js";

describe("runtime port adapters", () => {
  afterEach(async () => {
    resetSessionPortRegistryForTests();
    await releaseSessionPorts("port-sess").catch(() => undefined);
  });

  it("docker listen stays in 3000–3009; published maps to host block", async () => {
    const rt = createDockerSandboxRuntime();
    assert.equal(rt.kind, "docker");
    assert.equal(rt.publishedAppPortsEnv(), cloudPublishedAppPortsEnv());
    assert.equal(rt.isAllowedListenPort(FIRST_APP_PORT), true);
    assert.equal(rt.isAllowedListenPort(HOST_PORT_FLOOR), false);
    const listen = await rt.resolveListenPort({
      sessionId: "port-sess",
      appName: "web",
      preferred: FIRST_APP_PORT,
      usedListenPorts: []
    });
    assert.equal(listen, FIRST_APP_PORT);
    const published = await rt.resolvePublishedPort("port-sess", listen);
    assert.equal(published, hostPortForContainerPort("port-sess", listen));
    assert.notEqual(published, listen);
    assert.equal(resolveDockerPublishedPort("port-sess", listen), published);
  });

  it("cloud resolveListenPort allocates next free reserved port", () => {
    const listen = resolveCloudListenPort({
      sessionId: "s",
      appName: "api",
      preferred: 9999,
      usedListenPorts: [3000, 3001]
    });
    assert.equal(listen, 3002);
  });

  it("host listen allocates registry ports; published equals listen", async () => {
    const rt = createHostSandboxRuntime();
    assert.equal(rt.kind, "host");
    assert.equal(rt.publishedAppPortsEnv(), hostPublishedAppPortsEnv());
    assert.equal(rt.isAllowedListenPort(FIRST_APP_PORT), false);
    assert.equal(rt.isAllowedListenPort(HOST_PORT_FLOOR), true);
    assert.equal(rt.isAllowedListenPort(HOST_PORT_CEILING), true);

    const sessionId = `port-sess-${Date.now()}`;
    const listen = await rt.resolveListenPort({
      sessionId,
      appName: "web",
      preferred: FIRST_APP_PORT,
      usedListenPorts: []
    });
    assert.ok(listen >= HOST_PORT_FLOOR && listen <= HOST_PORT_CEILING);
    assert.ok(portsForSession(sessionId).includes(listen));
    assert.equal(await rt.resolvePublishedPort(sessionId, listen), listen);

    const reused = await rt.resolveListenPort({
      sessionId,
      appName: "web",
      preferred: listen,
      usedListenPorts: []
    });
    assert.equal(reused, listen);
    await releaseSessionPorts(sessionId);
  });
});
