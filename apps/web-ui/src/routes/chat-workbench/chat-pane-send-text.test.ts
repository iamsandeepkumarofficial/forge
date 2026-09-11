import { describe, it, expect, vi } from "vitest";
import { sendChatPaneText } from "./chat-pane-send-text";
import { runChatSend } from "./chat-pane-send.js";
import { deleteSessionMessagesFrom } from "../../lib/chat-agent.js";

vi.mock("./chat-pane-send.js", () => ({
  readAttachmentsAsText: vi.fn(async () => ""),
  runChatSend: vi.fn(async () => []),
  applyStreamToolEvent: vi.fn(({ prev }) => prev)
}));
vi.mock("../../lib/chat-agent.js", () => ({
  deleteSessionMessagesFrom: vi.fn(async () => undefined)
}));

function baseOpts(
  overrides: Partial<Parameters<typeof sendChatPaneText>[0]> = {}
) {
  return {
    raw: "hello",
    attachments: [],
    status: "ready" as const,
    sessionId: "s1",
    provider: "openai" as const,
    activeModel: "gpt-4o",
    autoModel: false,
    mode: "agent" as const,
    setInput: vi.fn(),
    setAttachments: vi.fn(),
    setError: vi.fn(),
    setStreamingText: vi.fn(),
    setStreamingReasoning: vi.fn(),
    setLiveToolParts: vi.fn(),
    flushLiveStep: vi.fn(),
    clearLiveTurn: vi.fn(),
    setStatus: vi.fn(),
    setMessages: vi.fn(),
    setActiveTurnId: vi.fn(),
    stickToBottomRef: { current: true },
    streamAbortRef: { current: null },
    ...overrides
  };
}

describe("sendChatPaneText", () => {
  it("no-ops when raw text is empty", async () => {
    const setStatus = vi.fn();
    await sendChatPaneText(baseOpts({ raw: "   ", setStatus }));
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("forwards mode to runChatSend", async () => {
    await sendChatPaneText(baseOpts({ mode: "plan", raw: "continue" }));
    expect(vi.mocked(runChatSend)).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "plan", text: "continue" })
    );
  });

  it("truncates from a user message before sending", async () => {
    const setMessages = vi.fn();
    await sendChatPaneText(
      baseOpts({
        raw: "edited",
        truncateFromMessageId: "m1",
        setMessages
      })
    );
    expect(deleteSessionMessagesFrom).toHaveBeenCalledWith("s1", "m1");
    expect(setMessages).toHaveBeenCalled();
    expect(vi.mocked(runChatSend)).toHaveBeenCalledWith(
      expect.objectContaining({ text: "edited" })
    );
  });
});
