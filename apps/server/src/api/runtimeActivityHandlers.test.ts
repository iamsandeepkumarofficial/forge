import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";

describe("runtimeActivityHandlers", () => {
  let handleGetRuntimeActivity: typeof import("./runtimeActivityHandlers.js").handleGetRuntimeActivity;
  let handleStopRuntimeSession: typeof import("./runtimeActivityHandlers.js").handleStopRuntimeSession;
  let handleStopRuntimeApp: typeof import("./runtimeActivityHandlers.js").handleStopRuntimeApp;
  const stopped: string[] = [];
  const stoppedApps: Array<{ sessionId: string; name: string }> = [];

  before(async () => {
    mock.module("../projects/runtimeActivity.js", {
      exports: {
        collectRuntimeActivity: async () => ({
          runtimeKind: "host",
          sessions: [],
          apps: [],
          ports: []
        }),
        stopRuntimeSession: async (sessionId: string) => {
          stopped.push(sessionId);
        },
        stopRuntimeApp: async (options: {
          sessionId: string;
          name: string;
        }) => {
          stoppedApps.push(options);
        }
      }
    });
    ({
      handleGetRuntimeActivity,
      handleStopRuntimeSession,
      handleStopRuntimeApp
    } = await import("./runtimeActivityHandlers.js"));
  });

  it("returns activity payload", async () => {
    const json: unknown[] = [];
    const res = {
      status(code: number) {
        assert.equal(code, 200);
        return this;
      },
      json(body: unknown) {
        json.push(body);
      }
    };
    await handleGetRuntimeActivity({} as never, res as never);
    assert.deepEqual(json[0], {
      runtimeKind: "host",
      sessions: [],
      apps: [],
      ports: []
    });
  });

  it("stops session and app", async () => {
    const sessionRes = {
      status() {
        return this;
      },
      json() {
        return undefined;
      }
    };
    await handleStopRuntimeSession(
      { params: { sessionId: "s1" } } as never,
      sessionRes as never
    );
    assert.deepEqual(stopped, ["s1"]);
    await handleStopRuntimeApp(
      { body: { sessionId: "s1", name: "web" } } as never,
      sessionRes as never
    );
    assert.deepEqual(stoppedApps, [{ sessionId: "s1", name: "web" }]);
  });

  it("rejects missing stop params", async () => {
    let code = 0;
    const res = {
      status(c: number) {
        code = c;
        return this;
      },
      json() {
        return undefined;
      }
    };
    await handleStopRuntimeSession({ params: {} } as never, res as never);
    assert.equal(code, 400);
    await handleStopRuntimeApp({ body: {} } as never, res as never);
    assert.equal(code, 400);
  });
});
