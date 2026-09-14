import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cloudPublishedAppPortsEnv,
  resolveCloudListenPort,
  resolveDockerPublishedPort
} from "./cloudPorts.js";
import {
  FIRST_APP_PORT,
  LAST_APP_PORT,
  hostPortForContainerPort
} from "../sessionSandbox/constants.js";

describe("cloudPorts", () => {
  it("publishes reserved listen range env", () => {
    assert.equal(
      cloudPublishedAppPortsEnv(),
      `${FIRST_APP_PORT}-${LAST_APP_PORT}`
    );
  });

  it("resolves next free reserved listen port", () => {
    assert.equal(
      resolveCloudListenPort({
        sessionId: "s",
        appName: "web",
        preferred: FIRST_APP_PORT,
        usedListenPorts: [FIRST_APP_PORT]
      }),
      FIRST_APP_PORT + 1
    );
  });

  it("maps docker published port via host block", () => {
    assert.equal(
      resolveDockerPublishedPort("port-sess", FIRST_APP_PORT),
      hostPortForContainerPort("port-sess", FIRST_APP_PORT)
    );
  });
});
