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

describe("mountChatRoutes", () => {
  let mountChatRoutes;
  before(async () => {
    mock.module("../../catalog/sessionChatRepository.js", {
      exports: {
        SessionMessageRepository: class {
          async listBySessionId() {
            return [
              {
                id: "m1",
                role: "user",
                parts: [{ type: "text", text: "hi" }],
                turnId: null,
                createdAt: new Date()
              }
            ];
          }
          async create(row) {
            return { id: "m2", ...row, createdAt: new Date() };
          }
        },
        ChatTurnRepository: class {
          async create(row) {
            return { id: "t1", ...row };
          }
          async getById() {
            return null;
          }
          async getRunningBySessionId() {
            return null;
          }
          async finish() {}
        },
        ChatTurnChunkRepository: class {
          async append() {
            return { id: "ch1" };
          }
          async listAfter() {
            return [];
          }
          async maxSeq() {
            return 0;
          }
        }
      }
    });
    ({ mountChatRoutes } = await import("./chat.routes.js"));
  });
  it("lists messages for a session", async () => {
    const router = Router();
    mountChatRoutes(router);
    const handlers = routeHandlers(
      router,
      "get",
      "/chat/sessions/:sessionId/messages"
    );
    const { res, state } = mockRes();
    await handlers[0]({ params: { sessionId: "s1" } }, res);
    assert.equal(state.body.messages.length, 1);
    assert.equal(state.body.messages[0].id, "m1");
  });
  it("rejects invalid role on create", async () => {
    const router = Router();
    mountChatRoutes(router);
    const handlers = routeHandlers(
      router,
      "post",
      "/chat/sessions/:sessionId/messages"
    );
    const { res, state } = mockRes();
    await handlers[0](
      { params: { sessionId: "s1" }, body: { role: "nope", parts: [] } },
      res
    );
    assert.equal(state.statusCode, 400);
  });
});
