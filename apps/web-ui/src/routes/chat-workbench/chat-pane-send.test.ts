import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  readAttachmentsAsText,
  runChatSend,
  applyStreamToolEvent
} from "./chat-pane-send";

vi.mock("../../lib/chat-agent.js", () => ({
  startChatTurn: vi.fn(),
  fetchSessionMessages: vi.fn(),
  consumeTurnStream: vi.fn()
}));

import {
  startChatTurn,
  fetchSessionMessages,
  consumeTurnStream
} from "../../lib/chat-agent.js";

describe("chat-pane-send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("readAttachmentsAsText embeds file contents", async () => {
    const file = {
      name: "note.txt",
      text: async () => "hello"
    } as File;
    const text = await readAttachmentsAsText([file]);
    expect(text).toContain("Attached file: note.txt");
    expect(text).toContain("hello");
  });

  it("runChatSend starts a turn and merges messages", async () => {
    vi.mocked(startChatTurn).mockResolvedValue({
      turnId: "t1",
      workflowId: "w1",
      streamUrl: "/stream"
    });
    vi.mocked(consumeTurnStream).mockResolvedValue(undefined);
    vi.mocked(fetchSessionMessages).mockResolvedValue([
      { id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }
    ]);
    const onTurnId = vi.fn();
    const onEvent = vi.fn();
    const rows = await runChatSend({
      sessionId: "s1",
      text: "hi",
      provider: "openai",
      model: "gpt-4o",
      mode: "agent",
      signal: new AbortController().signal,
      onTurnId,
      onEvent
    });
    expect(onTurnId).toHaveBeenCalledWith("t1");
    expect(consumeTurnStream).toHaveBeenCalledWith(
      expect.objectContaining({ streamUrl: "/stream" })
    );
    expect(rows[0]?.role).toBe("user");
  });

  it("applyStreamToolEvent updates tool cards", () => {
    const next = applyStreamToolEvent({
      prev: [],
      eventType: "tool_call",
      payload: {
        toolCallId: "c1",
        toolName: "read_file",
        args: { path: "a.ts" }
      }
    });
    expect(next).toHaveLength(1);
    expect(next[0]?.state).toBe("call");
  });
});
