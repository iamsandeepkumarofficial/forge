import { describe, it, expect, vi } from "vitest";
import { applyTurnStreamEvent } from "./chat-pane-stream-events";

vi.mock("./chat-pane-send.js", () => ({
  applyStreamToolEvent: vi.fn(({ prev }) => prev)
}));

describe("applyTurnStreamEvent", () => {
  it("resets live buffers on llm_start", () => {
    const setStreamingText = vi.fn();
    const setStreamingReasoning = vi.fn();
    const setLiveToolParts = vi.fn();
    applyTurnStreamEvent({
      eventType: "llm_start",
      payload: {},
      setStreamingText,
      setStreamingReasoning,
      setLiveToolParts,
      setError: vi.fn()
    });
    expect(setStreamingText).toHaveBeenCalledWith("");
    expect(setStreamingReasoning).toHaveBeenCalledWith("");
    expect(setLiveToolParts).toHaveBeenCalledWith([]);
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
