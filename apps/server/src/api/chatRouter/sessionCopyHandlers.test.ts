import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  handleBranchSessionMessages,
  handleDeleteMessagesFrom
} from "./sessionCopyHandlers.js";

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

describe("sessionCopyHandlers", () => {
  it("deletes from a message the owner can access", async () => {
    const { res, state } = mockRes();
    await handleDeleteMessagesFrom({
      req: {
        params: { sessionId: "s1", messageId: "m1" },
        forgeUser: { id: "u1" }
      } as never,
      res,
      features: {
        getBySessionId: async () => ({ id: "c1", userId: "u1" })
      } as never,
      messages: {
        listBySessionId: async () => [{ id: "m1", turnId: "t1" }],
        deleteFromMessage: async () => 3
      } as never,
      restoreFromTurn: async () => ({ workspaceRestored: true })
    });
    assert.deepEqual(state.body, { deleted: 3, workspaceRestored: true });
  });

  it("restores the workspace before hiding messages", async () => {
    const { res, state } = mockRes();
    const order: string[] = [];
    await handleDeleteMessagesFrom({
      req: {
        params: { sessionId: "s1", messageId: "u2" },
        forgeUser: { id: "u1" }
      } as never,
      res,
      features: {
        getBySessionId: async () => ({ id: "c1", userId: "u1" })
      } as never,
      messages: {
        listBySessionId: async () => [
          { id: "u1", turnId: "t1" },
          { id: "a1", turnId: "t1" },
          { id: "u2", turnId: "t2" }
        ],
        deleteFromMessage: async () => {
          order.push("hide");
          return 2;
        }
      } as never,
      restoreFromTurn: async (opts) => {
        order.push(`restore:${opts.turnId}`);
        return { workspaceRestored: true };
      }
    });
    assert.deepEqual(order, ["restore:t2", "hide"]);
    assert.deepEqual(state.body, { deleted: 2, workspaceRestored: true });
  });

  it("does not hide messages when restore fails", async () => {
    const { res, state } = mockRes();
    let hidden = false;
    await handleDeleteMessagesFrom({
      req: {
        params: { sessionId: "s1", messageId: "m1" },
        forgeUser: { id: "u1" }
      } as never,
      res,
      features: {
        getBySessionId: async () => ({ id: "c1", userId: "u1" })
      } as never,
      messages: {
        listBySessionId: async () => [{ id: "m1", turnId: "t1" }],
        deleteFromMessage: async () => {
          hidden = true;
          return 1;
        }
      } as never,
      restoreFromTurn: async () => {
        throw new Error("restore failed");
      }
    });
    assert.equal(hidden, false);
    assert.equal(state.statusCode, 500);
  });

  it("rejects a branch when the target already has messages", async () => {
    const { res, state } = mockRes();
    await handleBranchSessionMessages({
      req: {
        params: { sessionId: "s1" },
        body: { untilMessageId: "m1", targetSessionId: "s2" },
        forgeUser: { id: "u1" }
      } as never,
      res,
      features: {
        getBySessionId: async (id: string) => ({
          id,
          userId: "u1",
          projectId: "p1",
          workspaceId: null
        })
      } as never,
      messages: {
        listBySessionId: async () => [{ id: "existing" }],
        copyUntil: async () => 0
      } as never
    });
    assert.equal(state.statusCode, 409);
  });
});
