import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useChatPaneSession } from "./use-chat-pane-session";

vi.mock("../../lib/chat-agent.js", () => ({
  fetchSessionMessages: vi.fn(async () => []),
  cancelChatTurn: vi.fn()
}));
vi.mock("../../lib/tool-display.js", () => ({
  mergeSessionMessagesForUi: vi.fn(() => [])
}));

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useChatPaneSession", () => {
  it("starts ready with empty input", async () => {
    const { result } = renderHook(
      () =>
        useChatPaneSession({
          sessionId: "s1",
          projectId: "p1",
          chatId: "c1",
          provider: "openai",
          activeModel: "gpt-4o",
          autoModel: false,
          mode: "agent"
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.input).toBe("");
  });
});
