import { describe, it, expect, vi } from "vitest";
import { applyTurnStreamEvent } from "./chat-pane-stream-events";

vi.mock("./chat-pane-send.js", () => ({
  applyStreamToolEvent: vi.fn(({ prev }) => prev)
}));

describe("applyTurnStreamEvent", () => {
  it("flushes live activity on llm_start when onLlmStart is provided", () => {
    const onLlmStart = vi.fn();
    applyTurnStreamEvent({
      eventType: "llm_start",
      payload: {},
      setStreamingText: vi.fn(),
      setStreamingReasoning: vi.fn(),
      setLiveToolParts: vi.fn(),
      setError: vi.fn(),
      onLlmStart
    });
    expect(onLlmStart).toHaveBeenCalled();
  });

  it("appends reasoning deltas", () => {
    const setStreamingReasoning = vi.fn();
    applyTurnStreamEvent({
      eventType: "reasoning_delta",
      payload: { text: "why" },
      setStreamingText: vi.fn(),
      setStreamingReasoning,
      setLiveToolParts: vi.fn(),
      setError: vi.fn()
    });
    expect(setStreamingReasoning).toHaveBeenCalled();
    const updater = setStreamingReasoning.mock.calls[0]?.[0] as (
      prev: string
    ) => string;
    expect(updater("a")).toBe("awhy");
  });
});
