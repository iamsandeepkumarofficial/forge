import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { finalizeChatTurn, rejectChatToolCall } from "./chat.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("chat", () => {
  it("finalizeChatTurn posts assistant message finish and done chunk", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null
      });
      return new Response(
        JSON.stringify({ id: "m", role: "assistant", parts: [] }),
        { status: 200 }
      );
    }) as typeof fetch;
    await finalizeChatTurn({
      sessionId: "s1",
      turnId: "t1",
      assistantParts: [{ type: "text", text: "bye" }],
      status: "completed"
    });
    assert.ok(calls.some((c) => c.url.includes("/finish")));
    assert.ok(calls.some((c) => c.url.includes("/messages")));
    assert.ok(calls.some((c) => c.url.includes("/chunks")));
  });

  it("rejectChatToolCall emits start and failed result without executing", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null
      });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await rejectChatToolCall({
      turnId: "t1",
      toolCallId: "c1",
      toolName: "write_file",
      output: "truncated"
    });
    const chunks = calls.filter((c) => c.url.includes("/chunks"));
    assert.equal(chunks.length, 2);
    const bodies = chunks.map(
      (c) => c.body as { eventType: string; payload: { success?: boolean } }
    );
    assert.equal(bodies[0]?.eventType, "tool_start");
    assert.equal(bodies[1]?.eventType, "tool_result");
    assert.equal(bodies[1]?.payload.success, false);
  });
});
