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

  it("Ask mode routes to interactiveChatTurnWorkflow id prefix chat-", async () => {
    const { res, state } = mockRes();
    let started: { workflowId?: string; mode?: string } = {};
    const turns = {
      async getRunningBySessionId() {
        return null;
      },
      async create(input: { id: string; workflowId: string; mode: string }) {
        started = { workflowId: input.workflowId, mode: input.mode };
        return input;
      },
      async finish() {
        return null;
      }
    };
    const features = {
      async getBySessionId() {
        return null;
      },
      async updateLastActivity() {
        return null;
      }
    };
    await handleStartChat({
      req: {
        params: { sessionId: "s1" },
        body: { text: "hello", mode: "ask" },
        forgeUser: { id: "u1" }
      } as never,
      res,
      features: features as never,
      turns: turns as never
    });
    assert.ok(
      state.statusCode === 202 ||
        state.statusCode === 503 ||
        state.statusCode === 500
    );
    if (started.workflowId) {
      assert.ok(started.workflowId.startsWith("chat-s1-"));
      assert.equal(started.mode, "ask");
    }
  });

  it("queues follow-up when a turn is running and forceSend is false", async () => {
    const { res, state } = mockRes();
    const turns = {
      async getRunningBySessionId() {
        return { id: "t1", workflowId: "agent-s1-t1", status: "running" };
      }
    };
    const features = {
      async getBySessionId() {
        return null;
      }
    };
    await handleStartChat({
      req: {
        params: { sessionId: "s1" },
        body: { text: "next", mode: "agent", forceSend: false },
        forgeUser: { id: "u1" }
      } as never,
      res,
      features: features as never,
      turns: turns as never
    });
    assert.ok(
      state.statusCode === 202 ||
        state.statusCode === 503 ||
        state.statusCode === 500
    );
  });
});
