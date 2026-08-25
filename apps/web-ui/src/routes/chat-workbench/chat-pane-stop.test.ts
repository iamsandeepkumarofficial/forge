import { describe, it, expect, vi } from "vitest";
import { stopChatTurn } from "./chat-pane-stop";

vi.mock("../../lib/chat-agent.js", () => ({
  fetchSessionMessages: vi.fn(async () => []),
  cancelChatTurn: vi.fn(async () => undefined)
}));
vi.mock("../../lib/tool-display.js", () => ({
  mergeSessionMessagesForUi: vi.fn(() => [])
}));

describe("stopChatTurn", () => {
  it("aborts the stream and resets status", async () => {
    const abort = vi.fn();
    const setStatus = vi.fn();
    await stopChatTurn({
      sessionId: "s1",
      activeTurnId: null,
      streamAbortRef: { current: { abort } as unknown as AbortController },
      setActiveTurnId: vi.fn(),
      setStatus,
      setMessages: vi.fn(),
      setStreamingText: vi.fn(),
      setLiveToolParts: vi.fn()
    });
    expect(abort).toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith("ready");
  });
});
