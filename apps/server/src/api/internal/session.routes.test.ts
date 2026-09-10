import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";
import { Router } from "express";

function mockRes() {
  const state = { statusCode: 200, body: null, ended: false, text: null };
  const res = {
    status(code) {
      state.statusCode = code;
      return res;
    },
    json(body) {
      state.body = body;
      return res;
    },
    end() {
      state.ended = true;
      return res;
    },
    type() {
      return res;
    },
    send(text) {
      state.text = text;
      state.body = text;
      return res;
    },
    redirect(url) {
      state.statusCode = 302;
      state.body = url;
      return res;
    }
  };
  return { res, state };
}
function routeHandlers(router, method, routePath) {
  for (const layer of router.stack) {
    if (!layer.route) continue;
    if (layer.route.path !== routePath) continue;
    if (!layer.route.methods[method]) continue;
    return layer.route.stack.map((s) => s.handle);
  }
  return [];
}

describe("mountSessionRoutes", () => {
  let mountSessionRoutes;
  before(async () => {
    mock.module("../../projects/sessionProvision.js", {
      exports: {
        finalizeSessionProvision: async () => undefined
      }
    });
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
    mock.module("../../projects/appRunner.js", {
      exports: {
        listAppStatuses: async () => ({ exists: false, apps: [] }),
        writeForgeConfig: async () => undefined,
        readForgeConfig: async () => ({
          exists: false,
          source: "none",
          config: { apps: [] }
        }),
        runApp: async () => ({ name: "web", running: true }),
        stopApp: async () => undefined,
        appLogs: async () => "log",
        appLogsForSession: async () => "log",
        autoStartPreview: async () => undefined
      }
    });
    mock.module("../../projects/launchScaffold.js", {
      exports: {
        scaffoldForgeConfig: async () => ({ apps: [] }),
        ensureLaunchConfig: async () => ({
          ready: true,
          scaffolded: false,
          source: "launch",
          config: { apps: [] }
        })
      }
    });
    mock.module("./appRoutes.handlers.js", {
      exports: {
        handleAppRoutes: async (
          _req: unknown,
          res: { json: (body: unknown) => void }
        ) => {
          res.json({ routes: [] });
        }
      }
    });
    mock.module("./httpRequest.handlers.js", {
      exports: {
        handleAppHttpRequest: async (
          _req: unknown,
          res: { json: (body: unknown) => void }
        ) => {
          res.json({ status: 200 });
        }
      }
    });
    mock.module("../../projects/sandboxExec.js", {
      exports: {
        resolveSandbox: async () => ({
          containerName: "c",
          workingDir: "/workspace",
          repoDir: "repo"
        }),
        dockerExec: async () => ({ code: 0, stdout: "", stderr: "" })
      }
    });
    mock.module("./terminalTabs.handlers.js", {
      exports: {
        handleTerminalTabs: async (
          _req: unknown,
          res: { json: (body: unknown) => void }
        ) => {
          res.json({ tabs: [] });
        },
        handleTerminalTabCreate: async (
          _req: unknown,
          res: { json: (body: unknown) => void }
        ) => {
          res.json({ id: "t1" });
        },
        handleTerminalTabDelete: async (
          _req: unknown,
          res: { json: (body: unknown) => void }
        ) => {
          res.json({ ok: true });
        }
      }
    });
    mock.module("./terminal.handlers.js", {
      exports: {
        handleTerminalJobs: async (
          _req: unknown,
          res: { json: (body: unknown) => void }
        ) => {
          res.json({ jobs: [] });
        },
        handleTerminalStop: async (
          _req: unknown,
          res: { json: (body: unknown) => void }
        ) => {
          res.json({ ok: true });
        },
        handleTerminalRun: async (
          _req: unknown,
          res: { json: (body: unknown) => void }
        ) => {
          res.json({ success: true, output: "" });
        }
      }
    });
    ({ mountSessionRoutes } = await import("./session.routes.js"));
  });
  it("session start requires sessionId", async () => {
    const router = Router();
    mountSessionRoutes(router);
    const handlers = routeHandlers(router, "post", "/session/start");
    const { res, state } = mockRes();
    await handlers[0]({ body: {} }, res);
    assert.equal(state.statusCode, 400);
  });
  it("session start provisions sandbox", async () => {
    const router = Router();
    mountSessionRoutes(router);
    const handlers = routeHandlers(router, "post", "/session/start");
    const { res, state } = mockRes();
    await handlers[0]({ body: { sessionId: "s1" } }, res);
    assert.equal(state.body.sessionId, "s1");
    assert.equal(state.body.status, "ready");
  });
});
