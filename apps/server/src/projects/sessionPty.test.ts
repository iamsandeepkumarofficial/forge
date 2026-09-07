import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseTmuxWindowLine,
  parseTmuxWindowList,
  listTmuxWindows
} from "./sessionPty.js";
import { resetHostShellRegistryForTests } from "./hostSessionPty.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resetSandboxRuntimeCache } from "./sandboxRuntime/resolve.js";

describe("sessionPty", () => {
  const prevRuntime = process.env.SANDBOX_RUNTIME;
  let tmp = "";

  afterEach(async () => {
    if (prevRuntime === undefined) delete process.env.SANDBOX_RUNTIME;
    else process.env.SANDBOX_RUNTIME = prevRuntime;
    resetSandboxRuntimeCache();
    resetHostShellRegistryForTests();
    if (tmp) await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it("parses tmux list-windows format lines", () => {
    assert.deepEqual(parseTmuxWindowLine("1:main:1"), {
      windowId: "1",
      name: "main",
      active: true
    });
    assert.deepEqual(parseTmuxWindowLine("2:sh-abc:0"), {
      windowId: "2",
      name: "sh-abc",
      active: false
    });
    assert.deepEqual(parseTmuxWindowLine("3:my:weird:name:1"), {
      windowId: "3",
      name: "my:weird:name",
      active: true
    });
    assert.equal(parseTmuxWindowLine(""), null);
    assert.equal(parseTmuxWindowLine("bad"), null);
  });

  it("parses multiline tmux output", () => {
    assert.deepEqual(parseTmuxWindowList("1:main:1\n2:sh-abc:0\n\n"), [
      { windowId: "1", name: "main", active: true },
      { windowId: "2", name: "sh-abc", active: false }
    ]);
  });

  it("listTmuxWindows uses host node-pty registry in host mode", async () => {
    process.env.SANDBOX_RUNTIME = "host";
    process.env.FORGE_HOST_SANDBOX = "0";
    resetSandboxRuntimeCache();
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-sp-"));
    const windows = await listTmuxWindows(tmp);
    assert.ok(windows.some((w) => w.name === "main"));
  });
});
