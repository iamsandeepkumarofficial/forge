import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  handleCheckpointTurn,
  handleCreateSessionMessage
} from "./chat.handlers.js";

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

  it("checkpoints the workspace before inserting a user turn message", async () => {
    const { res, state } = mockRes();
    const order: string[] = [];
    await handleCreateSessionMessage({
      req: {
        params: { sessionId: "s1" },
        body: {
          role: "user",
          parts: [{ type: "text", text: "hi" }],
          turnId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        }
      } as never,
      res,
      messages: {
        create: async () => {
          order.push("create");
          return { id: "m1" };
        }
      } as never,
      checkpointWorkspace: async () => {
        order.push("checkpoint");
        return { portfolio: "a".repeat(40) };
      }
    });
    assert.deepEqual(order, ["checkpoint", "create"]);
    assert.equal(state.statusCode, 201);
  });

  it("does not checkpoint assistant or tool messages", async () => {
    const { res } = mockRes();
    let checkpointed = false;
    await handleCreateSessionMessage({
      req: {
        params: { sessionId: "s1" },
        body: {
          role: "assistant",
          parts: [{ type: "text", text: "ok" }],
          turnId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        }
      } as never,
      res,
      messages: {
        create: async () => ({ id: "m2" })
      } as never,
      checkpointWorkspace: async () => {
        checkpointed = true;
        return {};
      }
    });
    assert.equal(checkpointed, false);
  });

  it("checkpoints a turn that belongs to the session", async () => {
    const { res, state } = mockRes();
    await handleCheckpointTurn({
      req: {
        params: { turnId: "t1" },
        body: { sessionId: "s1" }
      } as never,
      res,
      turns: {
        getById: async () => ({ id: "t1", sessionId: "s1" })
      } as never,
      checkpointWorkspace: async () => ({ portfolio: "abc".repeat(14) + "ab" })
    });
    assert.deepEqual(state.body, {
      checkpoint: { portfolio: "abc".repeat(14) + "ab" }
    });
  });
});
