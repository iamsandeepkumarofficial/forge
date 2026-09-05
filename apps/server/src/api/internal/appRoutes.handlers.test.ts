import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

function mockRes() {
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
  return { res: res as never, state };
}

describe("handleAppRoutes", () => {
  let handleAppRoutes: typeof import("./appRoutes.handlers.js").handleAppRoutes;
  let listShouldThrow = false;

  before(async () => {
    mock.module("../../projects/appRunner.js", {
      exports: {
        listAppStatuses: async () => {
          if (listShouldThrow) throw new Error("boom");
          return {
            apps: [
              { name: "web", cwd: "apps/web" },
              { name: "api", cwd: "." }
            ]
          };
        }
      }
    });
    mock.module("../../projects/sandboxExec.js", {
      exports: {
        resolveSandbox: async () => ({
          containerName: "c1",
          workingDir: "/workspace",
          repoDir: "repo"
        }),
        dockerExec: async () => ({
          stdout: "GET /health\nPOST /login\n",
          stderr: ""
        })
      }
    });
    mock.module("../../projects/launchCwd.js", {
      exports: {
        resolveLaunchAppDir: async () => ({ appDir: "/workspace/apps/web" })
      }
    });
    mock.module("./appRoutes.js", {
      exports: {
        ROUTE_SCAN_SCRIPT: "echo scan",
        parseRouteScanLines: (text: string) =>
          text
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((line) => {
              const [method, path] = line.split(/\s+/);
              return { method, path };
            })
      }
    });
    ({ handleAppRoutes } = await import("./appRoutes.handlers.js"));
  });

  it("requires sessionId and appName", async () => {
    const a = mockRes();
    await handleAppRoutes({ query: {} } as never, a.res);
    assert.equal(a.state.statusCode, 400);

    const b = mockRes();
    await handleAppRoutes({ query: { sessionId: "s1" } } as never, b.res);
    assert.equal(b.state.statusCode, 400);
  });

  it("returns 404 when app is missing", async () => {
    listShouldThrow = false;
    const { res, state } = mockRes();
    await handleAppRoutes(
      { query: { sessionId: "s1", appName: "missing" } } as never,
      res
    );
    assert.equal(state.statusCode, 404);
  });

  it("scans and returns routes", async () => {
    listShouldThrow = false;
    const { res, state } = mockRes();
    await handleAppRoutes(
      { query: { sessionId: "s1", appName: "web" } } as never,
      res
    );
    assert.equal(state.statusCode, 200);
    assert.deepEqual(state.body, {
      routes: [
        { method: "GET", path: "/health" },
        { method: "POST", path: "/login" }
      ]
    });
  });

  it("returns 500 on unexpected errors", async () => {
    listShouldThrow = true;
    const { res, state } = mockRes();
    await handleAppRoutes(
      { query: { sessionId: "s1", appName: "web" } } as never,
      res
    );
    assert.equal(state.statusCode, 500);
    assert.deepEqual(state.body, { error: "boom" });
  });
});
