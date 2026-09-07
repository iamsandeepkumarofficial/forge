import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { ensureNativeStack, resolveNativeBin } from "./nativeStack.js";
import { NATIVE_DATABASE_URL } from "./hostMode.js";
import { materializeHostRuntimeEnv } from "./env.js";

function fakeChild(): ChildProcess {
  const ee = new EventEmitter() as ChildProcess;
  (ee as { pid: number }).pid = 4242;
  return ee;
}

describe("materializeHostRuntimeEnv", () => {
  it("sets desktop host env", () => {
    const env = materializeHostRuntimeEnv();
    assert.equal(env.FORGE_DESKTOP, "1");
    assert.equal(env.SANDBOX_RUNTIME, "host");
    assert.equal(env.DATABASE_URL, NATIVE_DATABASE_URL);
    assert.match(env.TEMPORAL_ADDRESS ?? "", /7233/);
  });
});

describe("nativeStack", () => {
  let tmp = "";

  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("resolveNativeBin prefers runtime bin then PATH", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forge-native-"));
    const runtimeBin = path.join(tmp, "bin");
    fs.mkdirSync(runtimeBin);
    const local = path.join(runtimeBin, "forge-fake-bin");
    fs.writeFileSync(local, "");
    assert.equal(
      resolveNativeBin("forge-fake-bin", {
        runtimeBin,
        which: () => "/usr/bin/forge-fake-bin"
      }),
      local
    );
    assert.equal(
      resolveNativeBin("forge-missing-bin", {
        runtimeBin,
        which: () => "/usr/bin/forge-missing-bin"
      }),
      "/usr/bin/forge-missing-bin"
    );
  });

  it("ensureNativeStack starts pg and temporal when ports closed", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forge-native2-"));
    const spawned: string[] = [];
    const runs: string[] = [];
    let tcpCalls = 0;
    const handle = await ensureNativeStack("/repo", {
      home: tmp,
      which: (cmd) => `/bin/${cmd}`,
      isOpen: async () => false,
      run: (opts) => {
        runs.push(`${opts.cmd} ${opts.args.join(" ")}`);
      },
      spawn: (opts) => {
        spawned.push(opts.label);
        return fakeChild();
      },
      waitTcp: async () => {
        tcpCalls += 1;
      }
    });
    assert.ok(spawned.includes("postgres"));
    assert.ok(spawned.includes("temporal"));
    assert.ok(runs.some((r) => r.includes("initdb")));
    assert.ok(runs.some((r) => r.includes("db:migrate")));
    assert.ok(tcpCalls >= 2);
    assert.equal(handle.children.length, 2);
    handle.stop();
  });
});
