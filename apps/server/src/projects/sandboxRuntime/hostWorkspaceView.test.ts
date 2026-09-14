import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  ensureHostWorkspaceRoot,
  workspaceMountsFromBinds
} from "./hostWorkspaceView.js";

describe("hostWorkspaceView", () => {
  const prevSessions = process.env.FORGE_SESSIONS_ROOT;
  let tmpRoot = "";

  afterEach(async () => {
    if (prevSessions === undefined) delete process.env.FORGE_SESSIONS_ROOT;
    else process.env.FORGE_SESSIONS_ROOT = prevSessions;
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("workspaceMountsFromBinds keeps longest container paths first", () => {
    const mounts = workspaceMountsFromBinds([
      { hostPath: "/host/frontend", containerPath: "/workspace/frontend" },
      { hostPath: "/host/backend", containerPath: "/workspace/backend" },
      { hostPath: "/host/other", containerPath: "/tmp/other" }
    ]);
    assert.equal(mounts.length, 2);
    assert.ok(
      mounts[0]!.containerPath.length >= mounts[1]!.containerPath.length
    );
    assert.equal(mounts[0]!.hostPath, path.resolve("/host/frontend"));
  });

  it("ensureHostWorkspaceRoot links members under a real /workspace view", async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-host-wsview-"));
    process.env.FORGE_SESSIONS_ROOT = path.join(tmpRoot, "sessions");
    const frontend = path.join(tmpRoot, "frontend");
    const backend = path.join(tmpRoot, "backend");
    await fs.mkdir(frontend, { recursive: true });
    await fs.mkdir(backend, { recursive: true });
    const mounts = workspaceMountsFromBinds([
      { hostPath: frontend, containerPath: "/workspace/frontend" },
      { hostPath: backend, containerPath: "/workspace/backend" }
    ]);
    const view = await ensureHostWorkspaceRoot({
      sessionId: "workbench-view",
      mounts
    });
    assert.ok(view.mounts.some((m) => m.containerPath === "/workspace"));
    const entries = await fs.readdir(view.root);
    assert.ok(entries.includes("frontend"));
    assert.ok(entries.includes("backend"));
  });

  it("ensureHostWorkspaceRoot reuses exact /workspace bind", async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-host-ws-exact-"));
    process.env.FORGE_SESSIONS_ROOT = path.join(tmpRoot, "sessions");
    const ws = path.join(tmpRoot, "workspace");
    await fs.mkdir(ws, { recursive: true });
    const mounts = workspaceMountsFromBinds([
      { hostPath: ws, containerPath: "/workspace" }
    ]);
    const view = await ensureHostWorkspaceRoot({
      sessionId: "sess-exact",
      mounts
    });
    assert.equal(view.root, path.resolve(ws));
    await fs.access(path.join(ws, ".forge-runtime"));
  });
});
