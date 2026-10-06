import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleStreamTurn } from "./streamHandlers.js";

function mockRes() {
  const state: { statusCode: number; body: unknown; ended: boolean } = {
    statusCode: 200,
    body: null,
    ended: false
  };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    },
    headersSent: false,
    end() {
      state.ended = true;
      return res;
    }
  };
  return { res: res as never, state };
}

describe("streamHandlers", () => {
  it("returns 404 when the session belongs to another user", async () => {
    const { res, state } = mockRes();
    await handleStreamTurn({
      req: {
        params: { sessionId: "s1", turnId: "t1" },
        headers: {},
        query: {},
        forgeUser: { id: "u1" }
      } as never,
      res,
      features: {
        async getBySessionId() {
          return { userId: "other" };
        }
      } as never,
      turns: {} as never,
      chunks: {} as never
    });
    assert.equal(state.statusCode, 404);
  });

  it("returns 404 when the turn is missing", async () => {
    const { res, state } = mockRes();
    await handleStreamTurn({
      req: {
        params: { sessionId: "s1", turnId: "t1" },
        headers: {},
        query: {},
        forgeUser: { id: "u1" }
      } as never,
      res,
      features: {
        async getBySessionId() {
          return null;
        }
      } as never,
      turns: {
        async getById() {
          return null;
        }
      } as never,
      chunks: {} as never
    });
    assert.equal(state.statusCode, 404);
  });

  it("returns 404 when cancelling a missing turn", async () => {
    const { res, state } = mockRes();
    const { handleCancelTurn } = await import("./streamHandlers.js");
    await handleCancelTurn({
      req: {
        params: { sessionId: "s1", turnId: "t1" },
        forgeUser: { id: "u1" }
      } as never,
      res,
      features: {
        async getBySessionId() {
          return null;
        }
      } as never,
      turns: {
        async getById() {
          return null;
        }
      } as never
    });
    assert.equal(state.statusCode, 404);
  });
});
