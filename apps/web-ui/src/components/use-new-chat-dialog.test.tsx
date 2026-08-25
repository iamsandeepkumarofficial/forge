import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNewChatDialog } from "./use-new-chat-dialog";

vi.mock("../lib/definitions-api.js", () => ({
  listWorkflows: vi.fn(async () => [
    { id: "sdlc", name: "SDLC", source: "system" }
  ])
}));

vi.mock("./new-chat-dialog-submit.js", () => ({
  submitNewChat: vi.fn()
}));

describe("useNewChatDialog", () => {
  it("adds a pending link", () => {
    const { result } = renderHook(() =>
      useNewChatDialog({
        projectId: "p1",
        existingChats: [],
        onClose: vi.fn(),
        onCreated: vi.fn()
      })
    );
    act(() => {
      result.current.setLinkLabel("L1");
      result.current.setLinkUrl("https://example.com");
    });
    act(() => {
      result.current.addLink();
    });
    expect(result.current.links).toHaveLength(1);
    expect(result.current.links[0]?.label).toBe("L1");
  });
});
