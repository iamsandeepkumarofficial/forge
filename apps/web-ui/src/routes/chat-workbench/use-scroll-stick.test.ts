import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScrollStick } from "./use-scroll-stick";

describe("useScrollStick", () => {
  it("returns scroller and stick refs", () => {
    const { result } = renderHook(() =>
      useScrollStick({
        messageCount: 0,
        streamingText: "",
        isStreaming: false,
        toolPartCount: 0
      })
    );
    expect(result.current.scrollerRef.current).toBeNull();
    expect(result.current.stickToBottomRef.current).toBe(true);
  });
});
