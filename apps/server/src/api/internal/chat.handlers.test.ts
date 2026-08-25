import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleCreateSessionMessage } from "./chat.handlers.js";

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

describe("chat.handlers", () => {
  it("rejects invalid role on create", async () => {
    const { res, state } = mockRes();
    await handleCreateSessionMessage({
      req: {
        params: { sessionId: "s1" },
        body: { role: "nope", parts: [] }
      } as never,
      res,
      messages: {} as never
    });
    assert.equal(state.statusCode, 400);
  });
});
