import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchModels,
  fetchModelContextWindow,
  fetchModelTokenLimits,
  fetchSessionMessages,
  startChatTurn,
  cancelChatTurn,
  deleteSessionMessagesFrom,
  copySessionMessagesUntil,
  REASONING_CAPABLE_PROVIDERS
} from "./chat-agent";

describe("chat-agent", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("exposes reasoning-capable providers", () => {
    expect(REASONING_CAPABLE_PROVIDERS).toContain("openai");
    expect(REASONING_CAPABLE_PROVIDERS).toContain("anthropic");
  });

  it("fetchModels maps model ids", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "gpt-4o" }, { id: "o3" }] })
    } as Response);
    const models = await fetchModels("openai");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/models?provider=openai",
      expect.any(Object)
    );
    expect(models).toEqual(["gpt-4o", "o3"]);
  });

  it("fetchModelContextWindow returns numeric window or null", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contextWindow: 128000 })
    } as Response);
    expect(await fetchModelContextWindow("openai", "gpt-4o")).toBe(128000);
  });

  it("fetchModelTokenLimits returns context and provider max output", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contextWindow: 128000,
        maxOutputTokens: 46080
      })
    } as Response);
    expect(
      await fetchModelTokenLimits("openai-compatible", "nvidia/nemotron")
    ).toEqual({
      contextWindow: 128000,
      maxOutputTokens: 46080
    });
  });

  it("fetchSessionMessages returns messages array", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [
          { id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }
        ]
      })
    } as Response);
    const messages = await fetchSessionMessages("s1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/sessions/s1/messages",
      expect.any(Object)
    );
    expect(messages).toHaveLength(1);
  });

  it("startChatTurn POSTs chat input", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        turnId: "t1",
        workflowId: "w1",
        streamUrl: "/stream/t1"
      })
    } as Response);
    const turn = await startChatTurn("s1", {
      text: "hi",
      provider: "openai",
      mode: "agent"
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/sessions/s1/chat",
      expect.objectContaining({ method: "POST" })
    );
    expect(turn.turnId).toBe("t1");
  });

  it("cancelChatTurn POSTs cancel", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    await cancelChatTurn("s1", "t1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/sessions/s1/turns/t1/cancel",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("deleteSessionMessagesFrom DELETEs from a message", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    await deleteSessionMessagesFrom("s1", "m2");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/sessions/s1/messages/from/m2",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("copySessionMessagesUntil POSTs a branch copy", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    await copySessionMessagesUntil({
      sourceSessionId: "s1",
      targetSessionId: "s2",
      untilMessageId: "m9"
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/sessions/s1/branch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          untilMessageId: "m9",
          targetSessionId: "s2"
        })
      })
    );
  });
});
