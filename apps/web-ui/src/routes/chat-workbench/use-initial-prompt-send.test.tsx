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
          clearStatePath: "/projects/p1/chats/c1",
          sendText
        }),
      { wrapper }
    );
    expect(sendText).toHaveBeenCalledWith("hello");
  });

  it("sends without navigate when clearStatePath omitted", () => {
    const sendText = vi.fn();
    renderHook(
      () =>
        useInitialPromptSend({
          initialPrompt: "fix workspace",
          historyLoaded: true,
          status: "ready",
          messageCount: 0,
          sendText
        }),
      { wrapper }
    );
    expect(sendText).toHaveBeenCalledWith("fix workspace");
  });

  it("can send even when history is not empty", () => {
    const sendText = vi.fn();
    renderHook(
      () =>
        useInitialPromptSend({
          initialPrompt: "fix again",
          historyLoaded: true,
          status: "ready",
          messageCount: 3,
          sendEvenIfNotEmpty: true,
          sendText
        }),
      { wrapper }
    );
    expect(sendText).toHaveBeenCalledWith("fix again");
  });
});
