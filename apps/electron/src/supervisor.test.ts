import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { describe, it } from "node:test";
import { Supervisor } from "./supervisor.js";

function fakeChild(): ChildProcess {
  return new EventEmitter() as ChildProcess;
}

describe("Supervisor", () => {
  it("getStatus starts as not started", () => {
    const supervisor = new Supervisor({
      findRoot: () => "/repo",
      readCfg: () => ({ desktop: { stopComposeOnQuit: false } }),
      stopCompose: () => undefined
    });
    assert.match(supervisor.getStatus(), /not started/);
  });

  it("startInfra is idempotent and updates status", async () => {
    const spawned: string[] = [];
    const supervisor = new Supervisor({
      findRoot: () => "/repo",
      readCfg: () => ({ desktop: { stopComposeOnQuit: false } }),
      stopCompose: () => {
        throw new Error("should not stop compose");
      },
      ensureStack: async (root) => {
        spawned.push(`stack:${root}`);
      },
      spawnHarness: (root) => {
        spawned.push(`harness:${root}`);
        return [fakeChild()];
      },
      waitHealth: async () => undefined
    });
    const first = await supervisor.startInfra();
    const second = await supervisor.startInfra();
    assert.match(first, /Infra started/);
    assert.equal(second, "Infra already started");
    assert.match(supervisor.getStatus(), /running/);
    assert.deepEqual(spawned, ["stack:/repo", "harness:/repo"]);
  });

  it("stopInfra kills children and can skip compose", async () => {
    let stopped = false;
    const supervisor = new Supervisor({
      findRoot: () => "/repo",
      readCfg: () => ({ desktop: { stopComposeOnQuit: false } }),
      stopCompose: () => {
        stopped = true;
      }
    });
    const msg = await supervisor.stopInfra();
    assert.match(msg, /stopped/);
    assert.equal(stopped, false);
    assert.match(supervisor.getStatus(), /not started/);
  });

  it("stopInfra stops compose when configured", async () => {
    const roots: string[] = [];
    const supervisor = new Supervisor({
      findRoot: () => "/repo",
      readCfg: () => ({ desktop: { stopComposeOnQuit: true } }),
      hostMode: false,
      stopCompose: (root) => {
        roots.push(root);
      }
    });
    await supervisor.stopInfra();
    assert.deepEqual(roots, ["/repo"]);
  });

  it("startInfra failure does not mark started", async () => {
    const supervisor = new Supervisor({
      findRoot: () => "/repo",
      readCfg: () => ({ desktop: { stopComposeOnQuit: false } }),
      stopCompose: () => undefined,
      ensureStack: async () => {
        throw new Error("docker");
      }
    });
    await assert.rejects(() => supervisor.startInfra(), /docker/);
    assert.match(supervisor.getStatus(), /not started/);
  });
});
