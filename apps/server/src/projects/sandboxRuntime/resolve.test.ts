import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  getSandboxRuntime,
  resetSandboxRuntimeCache,
  resolveSandboxRuntimeKind
} from "./resolve.js";

describe("resolveSandboxRuntime", () => {
  afterEach(() => {
    delete process.env.SANDBOX_RUNTIME;
    resetSandboxRuntimeCache();
  });

  it("defaults to docker", () => {
    assert.equal(resolveSandboxRuntimeKind(), "docker");
  });

  it("maps kubernetes aliases", () => {
    process.env.SANDBOX_RUNTIME = "k8s";
    assert.equal(resolveSandboxRuntimeKind(), "kubernetes");
  });

  it("returns docker runtime when selected", () => {
    const rt = getSandboxRuntime();
    assert.equal(typeof rt.createSession, "function");
    assert.equal(typeof rt.exec, "function");
  });

  it("returns kubernetes runtime when selected", () => {
    process.env.SANDBOX_RUNTIME = "kubernetes";
    resetSandboxRuntimeCache();
    const rt = getSandboxRuntime();
    assert.equal(typeof rt.createSession, "function");
    assert.equal(typeof rt.publishPreviewPort, "function");
  });
});
