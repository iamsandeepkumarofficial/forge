import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useInitialPromptSend } from "./use-initial-prompt-send";

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useInitialPromptSend", () => {
  it("sends when history is ready and empty", () => {
    const sendText = vi.fn();
    renderHook(
      () =>
        useInitialPromptSend({
          initialPrompt: "hello",
          historyLoaded: true,
          status: "ready",
          messageCount: 0,
          projectId: "p1",
          chatId: "c1",
          sendText
        }),
      { wrapper }
    );
    expect(sendText).toHaveBeenCalledWith("hello");
  });
});
