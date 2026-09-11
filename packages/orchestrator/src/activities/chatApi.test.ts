import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendChatMessage,
  ensureChatSandbox,
  finishChatTurn,
  getChatSystemPrompt,
  loadChatMessages
} from "./chatApi.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("chatApi", () => {
  it("loadChatMessages and appendChatMessage call internal APIs", async () => {
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (
        url.includes("/messages") &&
        (!init || !init.method || init.method === "GET")
      ) {
        return new Response(
          JSON.stringify({
            messages: [{ id: "m1", role: "user", parts: [] }]
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({ id: "m2", role: "assistant", parts: [] }),
        { status: 200 }
      );
    }) as typeof fetch;
    const loaded = await loadChatMessages("sess");
    assert.equal(loaded[0]?.id, "m1");
    const appended = await appendChatMessage({
      sessionId: "sess",
      role: "assistant",
      parts: [{ type: "text", text: "ok" }]
    });
    assert.equal(appended.id, "m2");
  });

  it("getChatSystemPrompt and ensureChatSandbox handle responses", async () => {
    globalThis.fetch = (async () =>
      new Response("prompt", { status: 200 })) as typeof fetch;
    assert.equal(await getChatSystemPrompt("s"), "prompt");
    globalThis.fetch = (async () =>
      new Response("x", { status: 500 })) as typeof fetch;
    assert.equal(await getChatSystemPrompt("s"), "");
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await ensureChatSandbox("s");
    assert.equal(called, true);
  });

  it("finishChatTurn posts finish payload", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null
      });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await finishChatTurn({ turnId: "t1", status: "completed" });
    assert.ok(calls.some((c) => c.url.includes("/finish")));
    assert.deepEqual(calls[0]?.body, {
      status: "completed",
      error: null
    });
  });
});
