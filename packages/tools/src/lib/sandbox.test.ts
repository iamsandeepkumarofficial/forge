import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { SandboxManager, defaultSandboxConfig } from "./sandbox.js";

describe("sandbox", () => {
  let tmp: string;

  before(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "forge-sandbox-"));
  });

  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("exposes a default sandbox config", () => {
    assert.equal(defaultSandboxConfig.image, "node:20-alpine");
    assert.equal(defaultSandboxConfig.workdir, "/workspace");
    assert.ok(defaultSandboxConfig.allowedCommands.includes("npm"));
    assert.ok(defaultSandboxConfig.allowedPaths.includes("/workspace"));
    assert.equal(defaultSandboxConfig.timeout, 120000);
  });

  it("createSession rejects when the base image cannot be started", async () => {
    const manager = new SandboxManager({
      baseImage: "forge-nonexistent-image:0.0.0",
      tempDir: tmp
    });
    await assert.rejects(
      () => manager.createSession(defaultSandboxConfig),
      (err: unknown) => err instanceof Error && err.message.length > 0
    );
  });

  it("execCommand reports docker failures without throwing", async () => {
    const manager = new SandboxManager({ tempDir: tmp });
    const result = await manager.execCommand(
      {
        id: "local",
        containerId: "forge-missing-container",
        config: { ...defaultSandboxConfig, timeout: 5000 }
      },
      "echo hi"
    );
    assert.ok(result.error || result.output.length >= 0);
    assert.notEqual(result.error, undefined);
  });

  it("cleanupSession swallows missing-container errors", async () => {
    const manager = new SandboxManager({ tempDir: tmp });
    await manager.cleanupSession({
      id: "local",
      containerId: "forge-missing-container",
      config: defaultSandboxConfig
    });
  });

  it("validateCommand throws because session config is unset", async () => {
    const manager = new SandboxManager({ tempDir: tmp });
    await assert.rejects(
      () => manager.validateCommand("npm install"),
      /Config not set/
    );
  });
});
