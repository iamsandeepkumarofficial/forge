import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { createHostSandboxRuntime } from "./hostAdapter.js";

describe("hostAdapter", () => {
  const prevSessions = process.env.FORGE_SESSIONS_ROOT;
  let tmpRoot = "";

  afterEach(async () => {
    if (prevSessions === undefined) delete process.env.FORGE_SESSIONS_ROOT;
    else process.env.FORGE_SESSIONS_ROOT = prevSessions;
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("createSession uses bind mount workspace and execs with scrubbed env", async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-host-"));
    process.env.FORGE_SESSIONS_ROOT = path.join(tmpRoot, "sessions");
    const ws = path.join(tmpRoot, "workspace");
    await fs.mkdir(ws, { recursive: true });

    const rt = createHostSandboxRuntime();
    const handle = await rt.createSession("sess-1", {
      bindMounts: [{ hostPath: ws, containerPath: "/workspace" }]
    });
    assert.equal(handle.runtime, "host");
    assert.equal(handle.ref, ws);

    const status = await rt.getStatus("sess-1");
    assert.equal(status.running, true);
    assert.equal(status.status, "ready");

    const r = await rt.exec({
      handle,
      cmd: ["node", "-e", "process.stdout.write('ok')"]
    });
    assert.equal(r.code, 0);
    assert.equal(r.stdout, "ok");

    process.env.FORGE_SECRET = "should-not-leak";
    try {
      const leaked = await rt.exec({
        handle,
        cmd: [
          "node",
          "-e",
          "process.stdout.write(process.env.FORGE_SECRET||'absent')"
        ]
      });
      assert.equal(leaked.stdout, "absent");
    } finally {
      delete process.env.FORGE_SECRET;
    }
  });
});
