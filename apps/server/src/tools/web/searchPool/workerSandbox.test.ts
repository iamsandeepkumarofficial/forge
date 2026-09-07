import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ensureWorker, workerContainerName } from "./workerSandbox.js";
import { resetSandboxRuntimeCache } from "../../../projects/sandboxRuntime/resolve.js";

describe("workerSandbox helpers", () => {
  const prevRuntime = process.env.SANDBOX_RUNTIME;
  const prevDesktop = process.env.FORGE_DESKTOP;

  afterEach(() => {
    if (prevRuntime === undefined) delete process.env.SANDBOX_RUNTIME;
    else process.env.SANDBOX_RUNTIME = prevRuntime;
    if (prevDesktop === undefined) delete process.env.FORGE_DESKTOP;
    else process.env.FORGE_DESKTOP = prevDesktop;
    resetSandboxRuntimeCache();
  });

  it("workerContainerName is deterministic", () => {
    assert.equal(workerContainerName(0), "forge-websearch-0");
    assert.equal(workerContainerName(3), "forge-websearch-3");
  });

  it("ensureWorker returns host virtual worker in host mode", async () => {
    process.env.SANDBOX_RUNTIME = "host";
    resetSandboxRuntimeCache();
    const w = await ensureWorker(0);
    assert.equal(w.containerName, "host-websearch-0");
    assert.equal(w.state, "ready");
  });
});
