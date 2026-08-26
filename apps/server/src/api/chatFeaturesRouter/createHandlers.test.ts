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

describe("chatFeatures createHandlers", () => {
  let handleGetChat: (req: unknown, res: unknown) => Promise<void>;

  before(async () => {
    mock.module("./shared.js", {
      exports: {
        param: (v: string | string[]) => (Array.isArray(v) ? v[0] : v),
        VALID_PRIORITIES: ["low", "medium", "high", "urgent"],
        chatRepo: { getById: async () => null },
        projectRepo: { getById: async () => null },
        chatFeatureService: {}
      }
    });
    mock.module("../../projects/sessionSandbox.js", {
      exports: {
        provisionSessionSandbox: async () => undefined
      }
    });
    mock.module("../../projects/appRunner.js", {
      exports: {
        autoStartPreview: async () => undefined
      }
    });
    ({ handleGetChat } = await import("./createHandlers.js"));
  });

  it("handleGetChat 404s when chat missing", async () => {
    const { res, state } = mockRes();
    await handleGetChat(
      {
        params: { projectId: "p1", chatId: "missing" },
        forgeUser: { id: "u1" }
      },
      res
    );
    assert.equal(state.statusCode, 404);
  });
});
