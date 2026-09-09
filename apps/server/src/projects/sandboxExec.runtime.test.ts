import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { dockerExec } from "./sandboxExec.js";
import {
  rememberSessionExecutionTarget,
  resetSandboxRuntimeCache
} from "./sandboxRuntime/resolve.js";

describe("dockerExec runtime routing", () => {
  const prevSessions = process.env.FORGE_SESSIONS_ROOT;
  let tmp = "";

  afterEach(async () => {
    if (prevSessions === undefined) delete process.env.FORGE_SESSIONS_ROOT;
    else process.env.FORGE_SESSIONS_ROOT = prevSessions;
    resetSandboxRuntimeCache();
    if (tmp) await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it("routes host exec through SandboxRuntime without docker CLI", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-route-"));
    process.env.FORGE_SESSIONS_ROOT = path.join(tmp, "sessions");
    rememberSessionExecutionTarget("s-route", "local");
    resetSandboxRuntimeCache();
    rememberSessionExecutionTarget("s-route", "local");

    const ws = path.join(tmp, "ws");
    await fs.mkdir(ws, { recursive: true });
    await fs.writeFile(path.join(ws, "hello.txt"), "hi", "utf8");

    const { createHostSandboxRuntime } =
      await import("./sandboxRuntime/hostAdapter.js");
    const rt = createHostSandboxRuntime();
    const handle = await rt.createSession("s-route", {
      bindMounts: [{ hostPath: ws, containerPath: "/workspace" }]
    });

    const r = await dockerExec({
      container: handle.ref,
      sessionId: "s-route",
      argv: ["cat", "--", "/workspace/hello.txt"]
    });
    assert.equal(r.code, 0);
    assert.equal(r.stdout, "hi");
  });
});
