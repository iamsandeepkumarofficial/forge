import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleStartChat } from "./handlers.js";

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

describe("chatRouter handlers", () => {
  it("rejects empty chat text", async () => {
    const { res, state } = mockRes();
    await handleStartChat({
      req: {
        params: { sessionId: "s1" },
        body: { text: "  " },
        forgeUser: { id: "u1" }
      } as never,
      res,
      features: {} as never,
      turns: {} as never
    });
    assert.equal(state.statusCode, 400);
  });
});
