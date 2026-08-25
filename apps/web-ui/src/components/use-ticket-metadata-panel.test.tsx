import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTicketMetadataPanel } from "./use-ticket-metadata-panel";

vi.mock("@/lib/projects-api", () => ({
  listAttachments: vi.fn(async () => []),
  listLinkedItems: vi.fn(async () => []),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  createLinkedItem: vi.fn(),
  deleteLinkedItem: vi.fn(),
  updateChat: vi.fn(),
  downloadAttachmentUrl: vi.fn()
}));

describe("useTicketMetadataPanel", () => {
  it("initializes type from chat", async () => {
    const { result } = renderHook(() =>
      useTicketMetadataPanel({
        projectId: "p1",
        chat: { id: "c1", title: "T", type: "bug" },
        allChats: []
      })
    );
    await waitFor(() => expect(result.current.type).toBe("bug"));
  });
});
