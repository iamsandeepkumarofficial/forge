import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it } from "node:test";
import { killProcessTree, spawnLogged } from "./processTree.js";

const EXIT_WAIT_MS = 3000;

describe("processTree", () => {
  it("spawnLogged starts a process that exits 0", async () => {
    const child = spawnLogged({
      cmd: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: process.cwd(),
      label: "test-spawn"
    });
    const code = await new Promise<number | null>((resolve) => {
      child.on("exit", (exitCode) => resolve(exitCode));
    });
    assert.equal(code, 0);
  });

  it("killProcessTree stops a long-running child", async () => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore",
      detached: process.platform !== "win32"
    });
    assert.ok(child.pid);
    killProcessTree(child.pid);
    const dead = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), EXIT_WAIT_MS);
      child.on("exit", () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    assert.equal(dead, true);
  });
});
