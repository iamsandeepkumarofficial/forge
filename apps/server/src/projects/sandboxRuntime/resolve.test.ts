import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  cloudSandboxKindFromEnv,
  executionTargetToKind,
  getSandboxRuntime,
  getSandboxRuntimeByKind,
  rememberSessionExecutionTarget,
  resetSandboxRuntimeCache
} from "./resolve.js";

describe("resolveSandboxRuntime", () => {
  const prevCloud = process.env.FORGE_CLOUD_SANDBOX;

  afterEach(() => {
    if (prevCloud === undefined) delete process.env.FORGE_CLOUD_SANDBOX;
    else process.env.FORGE_CLOUD_SANDBOX = prevCloud;
    resetSandboxRuntimeCache();
  });

  it("maps local to host and cloud to docker by default", () => {
    delete process.env.FORGE_CLOUD_SANDBOX;
    assert.equal(executionTargetToKind("local"), "host");
    assert.equal(executionTargetToKind("cloud"), "docker");
    assert.equal(cloudSandboxKindFromEnv(), "docker");
  });

  it("maps cloud to kubernetes when FORGE_CLOUD_SANDBOX=k8s", () => {
    process.env.FORGE_CLOUD_SANDBOX = "k8s";
    assert.equal(executionTargetToKind("cloud"), "kubernetes");
  });

  it("returns host runtime for local session cache", async () => {
    rememberSessionExecutionTarget("sess-local", "local");
    const rt = await getSandboxRuntime("sess-local");
    assert.equal(typeof rt.createSession, "function");
    assert.equal(getSandboxRuntimeByKind("host"), rt);
  });

  it("returns docker runtime for cloud session cache", async () => {
    delete process.env.FORGE_CLOUD_SANDBOX;
    rememberSessionExecutionTarget("sess-cloud", "cloud");
    const rt = await getSandboxRuntime("sess-cloud");
    assert.equal(typeof rt.createSession, "function");
  });
});
