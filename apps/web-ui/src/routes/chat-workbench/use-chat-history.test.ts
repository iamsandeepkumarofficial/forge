import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useChatHistory } from "./use-chat-history";

vi.mock("../../lib/chat-agent.js", () => ({
  fetchSessionMessages: vi.fn(async () => [
    { id: "1", role: "user", parts: [] }
  ])
}));
vi.mock("../../lib/tool-display.js", () => ({
  mergeSessionMessagesForUi: vi.fn((rows) => rows)
}));

describe("useChatHistory", () => {
  it("loads session messages", async () => {
    const { result } = renderHook(() => useChatHistory("s1"));
    await waitFor(() => expect(result.current.historyLoaded).toBe(true));
    expect(result.current.messages).toHaveLength(1);
  });
});
