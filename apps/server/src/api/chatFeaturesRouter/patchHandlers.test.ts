import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handlePatchChat } from "./patchHandlers.js";

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

describe("chatFeatures patchHandlers", () => {
  it("rejects invalid status on patch", async () => {
    const { res, state } = mockRes();
    await handlePatchChat(
      {
        params: { projectId: "p1", chatId: "c1" },
        body: { status: "nope" },
        forgeUser: { id: "u1" }
      } as never,
      res
    );
    assert.equal(state.statusCode, 400);
    assert.match(
      String((state.body as { error: string }).error),
      /Invalid status/
    );
  });
});
