import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  createHostSandboxRuntime,
  ensureHostWorkspaceRoot,
  mapHostLogicalPath,
  workspaceMountsFromBinds
} from "./hostAdapter.js";

describe("hostAdapter", () => {
  const prevSessions = process.env.FORGE_SESSIONS_ROOT;
  const prevSandbox = process.env.FORGE_HOST_SANDBOX;
  let tmpRoot = "";

  afterEach(async () => {
    if (prevSessions === undefined) delete process.env.FORGE_SESSIONS_ROOT;
    else process.env.FORGE_SESSIONS_ROOT = prevSessions;
    if (prevSandbox === undefined) delete process.env.FORGE_HOST_SANDBOX;
    else process.env.FORGE_HOST_SANDBOX = prevSandbox;
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("createSession uses bind mount workspace and execs with scrubbed env", async () => {
    process.env.FORGE_HOST_SANDBOX = "0";
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

  it("mapHostLogicalPath resolves multi-member mounts by longest prefix", () => {
    const frontend = "/host/wt/frontend";
    const backend = "/host/wt/backend";
    const mounts = workspaceMountsFromBinds([
      { hostPath: frontend, containerPath: "/workspace/frontend" },
      { hostPath: backend, containerPath: "/workspace/backend" }
    ]);
    const root = "/host/_host/sess";
    assert.equal(
      mapHostLogicalPath("/workspace/frontend", { root, mounts }),
      path.resolve(frontend)
    );
    assert.equal(
      mapHostLogicalPath("/workspace/frontend/apps/web", { root, mounts }),
      path.resolve(frontend, "apps/web")
    );
    assert.equal(
      mapHostLogicalPath("/workspace/backend", { root, mounts }),
      path.resolve(backend)
    );
    assert.equal(mapHostLogicalPath("/workspace", { root, mounts }), root);
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
    assert.equal(
      mapHostLogicalPath("/workspace", {
        root: view.root,
        mounts: view.mounts
      }),
      path.resolve(view.root)
    );
    assert.equal(
      mapHostLogicalPath("/workspace/frontend/package.json", {
        root: view.root,
        mounts: view.mounts
      }),
      path.resolve(frontend, "package.json")
    );
    const entries = await fs.readdir(view.root);
    assert.ok(entries.includes("frontend"));
    assert.ok(entries.includes("backend"));
  });

  it("exec maps member cwd to host worktree and errors clearly when missing", async () => {
    process.env.FORGE_HOST_SANDBOX = "0";
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-host-ws-"));
    process.env.FORGE_SESSIONS_ROOT = path.join(tmpRoot, "sessions");
    const frontend = path.join(tmpRoot, "frontend");
    const backend = path.join(tmpRoot, "backend");
    await fs.mkdir(frontend, { recursive: true });
    await fs.mkdir(backend, { recursive: true });

    const rt = createHostSandboxRuntime();
    const handle = await rt.createSession("workbench-1", {
      bindMounts: [
        { hostPath: frontend, containerPath: "/workspace/frontend" },
        { hostPath: backend, containerPath: "/workspace/backend" }
      ]
    });
    assert.ok(handle.ref.includes("_host"));

    const cwdProbe = await rt.exec({
      handle,
      cwd: "/workspace/frontend",
      cmd: ["node", "-e", "process.stdout.write(require('node:process').cwd())"]
    });
    assert.equal(cwdProbe.code, 0);
    assert.equal(
      await fs.realpath(cwdProbe.stdout),
      await fs.realpath(frontend)
    );

    const missing = await rt.exec({
      handle,
      cwd: "/workspace/missing-repo",
      cmd: ["node", "-e", "1"]
    });
    assert.equal(missing.code, 1);
    assert.match(missing.stderr, /Working directory does not exist/);
    assert.match(missing.stderr, /logical: \/workspace\/missing-repo/);
    assert.match(missing.stderr, /Known member repos: backend, frontend/);
  });

  it("destroySession removes _host dir but not exact /workspace worktree bind", async () => {
    process.env.FORGE_HOST_SANDBOX = "0";
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-host-rm-"));
    process.env.FORGE_SESSIONS_ROOT = path.join(tmpRoot, "sessions");
    const frontend = path.join(tmpRoot, "frontend");
    await fs.mkdir(frontend, { recursive: true });

    const rt = createHostSandboxRuntime();
    const multi = await rt.createSession("workbench-rm", {
      bindMounts: [{ hostPath: frontend, containerPath: "/workspace/frontend" }]
    });
    assert.ok(multi.ref.includes("_host"));
    await fs.access(multi.ref);
    await rt.destroySession("workbench-rm");
    await assert.rejects(() => fs.access(multi.ref));
    await fs.access(frontend);

    const ws = path.join(tmpRoot, "single-ws");
    await fs.mkdir(ws, { recursive: true });
    await fs.writeFile(path.join(ws, "keep.txt"), "x");
    const single = await rt.createSession("sess-single", {
      bindMounts: [{ hostPath: ws, containerPath: "/workspace" }]
    });
    assert.equal(single.ref, ws);
    await rt.destroySession("sess-single");
    assert.equal(await fs.readFile(path.join(ws, "keep.txt"), "utf8"), "x");
  });
});
