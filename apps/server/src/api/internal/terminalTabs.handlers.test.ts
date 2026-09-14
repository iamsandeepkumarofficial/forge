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
  return { res, state };
}

describe("terminalTabs.handlers", { concurrency: false }, () => {
  let handleTerminalTabs: typeof import("./terminalTabs.handlers.js").handleTerminalTabs;
  let handleTerminalTabCreate: typeof import("./terminalTabs.handlers.js").handleTerminalTabCreate;
  let handleTerminalTabDelete: typeof import("./terminalTabs.handlers.js").handleTerminalTabDelete;

  before(async () => {
    mock.module("../../projects/sandboxExec.js", {
      exports: {
        resolveSandbox: async () => ({ containerName: "c" })
      }
    });
    mock.module("../../projects/sessionPty.js", {
      exports: {
        listTmuxWindows: async () => [
          { windowId: "1", name: "main", active: true }
        ],
        newShellWindow: async () => "sh-new",
        killShellWindow: async () => undefined
      }
    });
    mock.module("../../projects/appRunner.js", {
      exports: {
        listAppRunningFlags: async () => [{ name: "web", running: true }]
      }
    });
    ({
      handleTerminalTabs,
      handleTerminalTabCreate,
      handleTerminalTabDelete
    } = await import("./terminalTabs.handlers.js"));
  });

  it("lists merged tabs", async () => {
    const { res, state } = mockRes();
    await handleTerminalTabs(
      { query: { sessionId: "s1" }, body: {} } as never,
      res as never
    );
    assert.equal(state.statusCode, 200);
    const body = state.body as { tabs: Array<{ id: string }> };
    assert.deepEqual(
      body.tabs.map((tab) => tab.id),
      ["main", "app:web"]
    );
  });

  it("creates and deletes shell tabs", async () => {
    const create = mockRes();
    await handleTerminalTabCreate(
      { query: {}, body: { sessionId: "s1" } } as never,
      create.res as never
    );
    const body = create.state.body as { tabId: string; tab: { id: string } };
    assert.equal(body.tabId, "sh-new");
    assert.equal(body.tab.id, "sh-new");

    const del = mockRes();
    await handleTerminalTabDelete(
      { query: { sessionId: "s1" }, params: { id: "sh-new" }, body: {} } as never,
      del.res as never
    );
    assert.deepEqual(del.state.body, { ok: true });
  });
});
