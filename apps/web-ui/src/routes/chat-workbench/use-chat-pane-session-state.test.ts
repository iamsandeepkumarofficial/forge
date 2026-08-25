import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useChatPaneSessionState } from "./use-chat-pane-session-state";

describe("useChatPaneSessionState", () => {
  it("starts ready with empty input", () => {
    const { result } = renderHook(() => useChatPaneSessionState());
    expect(result.current.status).toBe("ready");
    expect(result.current.input).toBe("");
    expect(result.current.canSend).toBe(false);
  });
});
