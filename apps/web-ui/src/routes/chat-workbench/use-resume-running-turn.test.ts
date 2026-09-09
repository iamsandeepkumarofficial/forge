import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useResumeRunningTurn } from "./use-resume-running-turn";

vi.mock("./chat-pane-resume.js", () => ({
  resumeIfRunningTurn: vi.fn(async () => false)
}));

describe("useResumeRunningTurn", () => {
  it("reports resumeChecked once history is ready and idle", async () => {
    const { result } = renderHook(() =>
      useResumeRunningTurn({
        sessionId: "s1",
        historyLoaded: true,
        status: "ready",
        streamAbortRef: { current: null },
        setStatus: vi.fn(),
        setActiveTurnId: vi.fn(),
        setStreamingText: vi.fn(),
        setStreamingReasoning: vi.fn(),
        setLiveToolParts: vi.fn(),
        setError: vi.fn(),
        setMessages: vi.fn()
      })
    );
    await waitFor(() => expect(result.current.resumeChecked).toBe(true));
  });

  it("treats non-ready status as already checked", () => {
    const { result } = renderHook(() =>
      useResumeRunningTurn({
        sessionId: "s1",
        historyLoaded: true,
        status: "streaming",
        streamAbortRef: { current: null },
        setStatus: vi.fn(),
        setActiveTurnId: vi.fn(),
        setStreamingText: vi.fn(),
        setStreamingReasoning: vi.fn(),
        setLiveToolParts: vi.fn(),
        setError: vi.fn(),
        setMessages: vi.fn()
      })
    );
    expect(result.current.resumeChecked).toBe(true);
  });
});
