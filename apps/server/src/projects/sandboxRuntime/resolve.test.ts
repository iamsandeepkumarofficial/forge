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
    delete process.env.FORGE_DESKTOP;
    resetSandboxRuntimeCache();
  });

  it("defaults to docker", () => {
    assert.equal(resolveSandboxRuntimeKind(), "docker");
  });

  it("defaults to host when FORGE_DESKTOP=1", () => {
    process.env.FORGE_DESKTOP = "1";
    assert.equal(resolveSandboxRuntimeKind(), "host");
  });

  it("SANDBOX_RUNTIME=docker wins over FORGE_DESKTOP", () => {
    process.env.FORGE_DESKTOP = "1";
    process.env.SANDBOX_RUNTIME = "docker";
    assert.equal(resolveSandboxRuntimeKind(), "docker");
  });

  it("maps host and kubernetes aliases", () => {
    process.env.SANDBOX_RUNTIME = "host";
    assert.equal(resolveSandboxRuntimeKind(), "host");
    process.env.SANDBOX_RUNTIME = "k8s";
    assert.equal(resolveSandboxRuntimeKind(), "kubernetes");
  });

  it("returns docker runtime when selected", () => {
    const rt = getSandboxRuntime();
    assert.equal(typeof rt.createSession, "function");
    assert.equal(typeof rt.exec, "function");
    assert.equal(typeof rt.getStatus, "function");
  });

  it("returns host runtime when selected", () => {
    process.env.SANDBOX_RUNTIME = "host";
    resetSandboxRuntimeCache();
    const rt = getSandboxRuntime();
    assert.equal(typeof rt.createSession, "function");
    assert.equal(typeof rt.publishPreviewPort, "function");
    assert.equal(typeof rt.getStatus, "function");
  });

  it("returns kubernetes runtime when selected", () => {
    process.env.SANDBOX_RUNTIME = "kubernetes";
    resetSandboxRuntimeCache();
    const rt = getSandboxRuntime();
    assert.equal(typeof rt.createSession, "function");
    assert.equal(typeof rt.publishPreviewPort, "function");
  });
});
