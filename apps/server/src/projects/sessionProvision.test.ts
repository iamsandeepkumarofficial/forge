import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("finalizeSessionProvision", () => {
  let finalizeSessionProvision: typeof import("./sessionProvision.js").finalizeSessionProvision;
  const calls = {
    getBySessionId: 0,
    restore: 0,
    ensureLaunch: 0,
    autoStart: 0,
    log: 0
  };
  let restoreThrows = false;
  let launchThrows = false;

  before(async () => {
    mock.module("../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId() {
            calls.getBySessionId += 1;
            return { id: "c1" };
          }
        }
      }
    });
    mock.module("./workspaceEnvironment.js", {
      exports: {
        restoreWorkspaceDepsForSession: async () => {
          calls.restore += 1;
          if (restoreThrows) throw new Error("restore failed");
        }
      }
    });
    mock.module("./launchScaffold.js", {
      exports: {
        ensureLaunchConfig: async () => {
          calls.ensureLaunch += 1;
          if (launchThrows) throw new Error("launch failed");
          return { ready: true, source: "session" };
        }
      }
    });
    mock.module("./appRunner.js", {
      exports: {
        readForgeConfig: async () => ({
          config: { apps: [{ name: "web" }, { name: "api" }] }
        }),
        autoStartPreview: async () => {
          calls.autoStart += 1;
        }
      }
    });
    mock.module("./launchConfigLog.js", {
      exports: {
        formatLaunchAppNames: (apps: Array<{ name: string }>) =>
          apps.map((a) => a.name).join(","),
        logLaunchConfigProvisionResult: () => {
          calls.log += 1;
        }
      }
    });
    ({ finalizeSessionProvision } = await import("./sessionProvision.js"));
  });

  it("restores deps and scaffolds launch without auto-starting preview", async () => {
    Object.assign(calls, {
      getBySessionId: 0,
      restore: 0,
      ensureLaunch: 0,
      autoStart: 0,
      log: 0
    });
    restoreThrows = false;
    launchThrows = false;
    await finalizeSessionProvision("s1");
    assert.equal(calls.getBySessionId, 1);
    assert.equal(calls.restore, 1);
    assert.equal(calls.ensureLaunch, 1);
    assert.equal(calls.log, 1);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls.autoStart, 0);
  });

  it("continues when restore or launch fails", async () => {
    Object.assign(calls, {
      getBySessionId: 0,
      restore: 0,
      ensureLaunch: 0,
      autoStart: 0,
      log: 0
    });
    restoreThrows = true;
    launchThrows = true;
    await finalizeSessionProvision("s2");
    assert.equal(calls.restore, 1);
    assert.equal(calls.ensureLaunch, 1);
    assert.equal(calls.log, 0);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls.autoStart, 0);
  });
});
