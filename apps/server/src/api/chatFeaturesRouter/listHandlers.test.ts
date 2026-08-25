import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleCreateComment } from "./listHandlers.js";

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

describe("chatFeatures listHandlers", () => {
  it("rejects empty comment text", async () => {
    const { res, state } = mockRes();
    await handleCreateComment(
      {
        params: { projectId: "p1", chatId: "c1" },
        body: { text: "  " },
        forgeUser: { id: "u1" }
      } as never,
      res
    );
    assert.equal(state.statusCode, 400);
  });
});
