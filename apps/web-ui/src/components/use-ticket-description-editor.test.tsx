import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTicketDescriptionEditor } from "./use-ticket-description-editor";

vi.mock("@tiptap/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tiptap/react")>();
  return {
    ...actual,
    useEditor: () => null
  };
});

vi.mock("@/lib/projects-api", () => ({
  updateChat: vi.fn()
}));

vi.mock("@/lib/description-document", () => ({
  descriptionToTipTap: () => ({ type: "doc", content: [] }),
  tipTapToDescription: () => ({ version: 1, blocks: [] })
}));

describe("useTicketDescriptionEditor", () => {
  it("returns null editor when tip tap is unavailable", () => {
    const { result } = renderHook(() =>
      useTicketDescriptionEditor({
        projectId: "p1",
        chatId: "c1",
        description: null
      })
    );
    expect(result.current.editor).toBeNull();
  });
});
