import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  attachHostShellWindow,
  destroyHostShells,
  killHostShellWindow,
  listHostShellWindows,
  newHostShellWindow,
  resetHostShellRegistryForTests
} from "./hostSessionPty.js";

describe("hostSessionPty", () => {
  let tmp = "";
  const prevSandbox = process.env.FORGE_HOST_SANDBOX;

  afterEach(async () => {
    if (tmp) {
      destroyHostShells(tmp);
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
    resetHostShellRegistryForTests();
    if (prevSandbox === undefined) delete process.env.FORGE_HOST_SANDBOX;
    else process.env.FORGE_HOST_SANDBOX = prevSandbox;
  });

  it("creates lists attaches and kills host shell tabs", async () => {
    process.env.FORGE_HOST_SANDBOX = "0";
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-pty-"));
    const listed = await listHostShellWindows(tmp);
    assert.ok(listed.some((w) => w.name === "main"));
    const name = await newHostShellWindow(tmp);
    assert.match(name, /^sh-/);
    const chunks: Buffer[] = [];
    const attach = await attachHostShellWindow({
      root: tmp,
      windowName: "main",
      cols: 80,
      rows: 24,
      onData: (c) => chunks.push(c),
      onClose: () => undefined
    });
    attach.write("echo forge-pty-ok\r");
    await new Promise((r) => setTimeout(r, 400));
    attach.close();
    const text = Buffer.concat(chunks).toString("utf8");
    assert.match(text, /forge-pty-ok/);
    await killHostShellWindow(tmp, name);
    const after = await listHostShellWindows(tmp);
    assert.equal(
      after.some((w) => w.name === name),
      false
    );
  });

  it("refuses to kill the last main shell", async () => {
    process.env.FORGE_HOST_SANDBOX = "0";
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-pty2-"));
    await listHostShellWindows(tmp);
    await assert.rejects(
      () => killHostShellWindow(tmp, "main"),
      /Cannot close the last shell tab/
    );
  });
});
