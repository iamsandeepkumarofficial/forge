import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("session.handlers", () => {
  let handleSessionStart: (req: unknown, res: unknown) => Promise<void>;

  before(async () => {
    mock.module("../../projects/sessionSandbox.js", {
      exports: {
        provisionSessionSandbox: async () => ({
          status: "ready",
          containerId: "c"
        }),
        getSessionSandboxStatus: async () => ({
          status: "ready",
          running: true,
          workingDir: "/workspace"
        })
      }
    });
    mock.module("../../projects/codeArchive.js", {
      exports: {
        spawnRepoTarGz: async () => ({
          child: { stdout: { pipe() {} }, stderr: { on() {} }, on() {} },
          filename: "repo.tar.gz"
        }),
        promoteToCanonical: async () => ({ target: "objectStore", files: 0 })
      }
    });
    mock.module("../../projects/appRunner.js", {
      exports: {
        listAppStatuses: async () => ({ exists: false, apps: [] }),
        writeForgeConfig: async () => undefined,
        runApp: async () => ({ name: "web", running: true }),
        stopApp: async () => undefined,
        appLogs: async () => "log",
        appLogsForSession: async () => "log"
      }
    });
    mock.module("../../projects/launchScaffold.js", {
      exports: {
        scaffoldForgeConfig: async () => ({ apps: [] })
      }
    });
    ({ handleSessionStart } = await import("./session.handlers.js"));
  });

  it("session start requires sessionId", async () => {
    const state: { statusCode: number; body: unknown } = {
      statusCode: 200,
      body: null
    };
    const res = {
      status(code: number) {
        state.statusCode = code;
        return res;
      },
      json(body: unknown) {
        state.body = body;
        return res;
      }
    };
    await handleSessionStart({ body: {} }, res);
    assert.equal(state.statusCode, 400);
  });
});
