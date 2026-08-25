import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

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

describe("createChatRouter", () => {
  let createChatRouter;
  before(async () => {
    mock.module("./pocAuth.js", {
      exports: { createPocAuth: () => (_r, _s, n) => n() }
    });
    mock.module("../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId(sessionId) {
            return { id: "c1", sessionId, userId: "u1", projectId: "p1" };
          }
        }
      }
    });
    mock.module("../catalog/sessionChatRepository.js", {
      exports: {
        SessionMessageRepository: class {
          async listBySessionId() {
            return [];
          }
          async create() {
            return { id: "m1" };
          }
        },
        ChatTurnRepository: class {
          async getRunningBySessionId() {
            return null;
          }
          async create() {
            return { id: "t1" };
          }
          async finish() {}
        },
        ChatTurnChunkRepository: class {
          async append() {}
          async listAfter() {
            return [];
          }
        }
      }
    });
    mock.module("../orchestration/chatTemporalClient.js", {
      exports: {
        newTurnId: () => "turn-1",
        startInteractiveChatTurn: async () => "wf-1",
        cancelInteractiveChatTurn: async () => undefined
      }
    });
    ({ createChatRouter } = await import("./chatRouter.js"));
  });
  it("lists session messages for owner", async () => {
    const router = createChatRouter();
    const handlers = routeHandlers(
      router,
      "get",
      "/sessions/:sessionId/messages"
    );
    const { res, state } = mockRes();
    await handlers[handlers.length - 1](
      { params: { sessionId: "s1" }, forgeUser: { id: "u1" } },
      res
    );
    assert.deepEqual(state.body, { messages: [] });
  });
  it("rejects empty chat text", async () => {
    const router = createChatRouter();
    const handlers = routeHandlers(router, "post", "/sessions/:sessionId/chat");
    const { res, state } = mockRes();
    await handlers[handlers.length - 1](
      {
        params: { sessionId: "s1" },
        body: { text: "  " },
        forgeUser: { id: "u1" }
      },
      res
    );
    assert.equal(state.statusCode, 400);
  });
});
