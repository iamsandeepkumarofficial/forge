import { describe, it, expect, vi } from "vitest";
import {
  findRunningChatTurn,
  streamUrlForTurn,
  handleResumeStreamEvent,
  resumeIfRunningTurn
} from "./chat-pane-resume";
import {
  fetchRunningTurn,
  fetchSessionMessages,
  consumeTurnStream
} from "../../lib/chat-agent.js";

vi.mock("../../lib/chat-agent.js", () => ({
  fetchRunningTurn: vi.fn(),
  fetchSessionMessages: vi.fn(async () => []),
  consumeTurnStream: vi.fn(async () => undefined)
}));
vi.mock("../../lib/tool-display.js", () => ({
  mergeSessionMessagesForUi: vi.fn((rows) => rows)
}));
vi.mock("./chat-pane-stream-events.js", () => ({
  applyTurnStreamEvent: vi.fn()
}));

function controllers() {
  return {
    streamAbortRef: { current: null as AbortController | null },
    setStatus: vi.fn(),
    setActiveTurnId: vi.fn(),
    setStreamingText: vi.fn(),
    setStreamingReasoning: vi.fn(),
    setLiveToolParts: vi.fn(),
    flushLiveStep: vi.fn(),
    clearLiveTurn: vi.fn(),
    setError: vi.fn(),
    setMessages: vi.fn()
  };
}

describe("chat-pane-resume", () => {
  it("builds stream urls", () => {
    expect(streamUrlForTurn("s1", "t1")).toBe(
      "/api/sessions/s1/turns/t1/stream"
    );
  });

  it("findRunningChatTurn delegates to API", async () => {
    vi.mocked(fetchRunningTurn).mockResolvedValueOnce({
      id: "t1",
      workflowId: "w1",
      status: "running"
    });
    await expect(findRunningChatTurn("s1")).resolves.toEqual({
      id: "t1",
      workflowId: "w1",
      status: "running"
    });
  });

  it("refreshes messages on tool_result", () => {
    handleResumeStreamEvent({
      eventType: "tool_result",
      payload: { toolName: "bash" },
      sessionId: "s1",
      ...controllers()
    });
    expect(vi.mocked(fetchSessionMessages)).toHaveBeenCalledWith("s1");
  });

  it("resumeIfRunningTurn no-ops when idle", async () => {
    vi.mocked(fetchRunningTurn).mockResolvedValueOnce(null);
    const ac = new AbortController();
    await expect(
      resumeIfRunningTurn({
        sessionId: "s1",
        signal: ac.signal,
        ac,
        controllers: controllers()
      })
    ).resolves.toBe(false);
    expect(vi.mocked(consumeTurnStream)).not.toHaveBeenCalled();
  });

  it("resumeIfRunningTurn attaches when a turn is running", async () => {
    vi.mocked(fetchRunningTurn).mockResolvedValueOnce({
      id: "t1",
      workflowId: "w1",
      status: "running"
    });
    const ac = new AbortController();
    const c = controllers();
    await expect(
      resumeIfRunningTurn({
        sessionId: "s1",
        signal: ac.signal,
        ac,
        controllers: c
      })
    ).resolves.toBe(true);
    expect(c.setStatus).toHaveBeenCalledWith("streaming");
    expect(c.setActiveTurnId).toHaveBeenCalledWith("t1");
    expect(vi.mocked(consumeTurnStream)).toHaveBeenCalled();
  });
});
