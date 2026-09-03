import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  preferredSandboxImageName,
  DEFAULT_SANDBOX_IMAGE,
  FIRST_APP_PORT
} from "./constants.js";
import { publishedHostPortsNeedingRepair } from "./container.js";

describe("sessionSandbox container helpers", () => {
  it("does not treat unused reserved ports as missing host bindings", async () => {
    const missing = await publishedHostPortsNeedingRepair({
      containerName: "c",
      portBase: 40000,
      isContainerOpen: async (port) => port === FIRST_APP_PORT,
      isHostOpen: async (port) => port === 40000
    });
    assert.deepEqual(missing, []);
  });

  it("flags a published host port only when the app is listening inside", async () => {
    const missing = await publishedHostPortsNeedingRepair({
      containerName: "c",
      portBase: 40000,
      isContainerOpen: async (port) => port === FIRST_APP_PORT,
      isHostOpen: async () => false
    });
    assert.deepEqual(missing, [40000]);
  });

  it("preferredSandboxImageName falls back to default", () => {
    const prev = process.env.FORGE_SANDBOX_IMAGE;
    delete process.env.FORGE_SANDBOX_IMAGE;
    try {
      assert.equal(preferredSandboxImageName(), DEFAULT_SANDBOX_IMAGE);
    } finally {
      if (prev !== undefined) process.env.FORGE_SANDBOX_IMAGE = prev;
    }
  });
});
