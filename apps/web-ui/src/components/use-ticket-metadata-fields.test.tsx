import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTicketMetadataFields } from "./use-ticket-metadata-fields";

vi.mock("@/lib/projects-api", () => ({
  listAttachments: vi.fn(async () => []),
  listLinkedItems: vi.fn(async () => [])
}));

describe("useTicketMetadataFields", () => {
  it("initializes type from chat", async () => {
    const { result } = renderHook(() =>
      useTicketMetadataFields({
        projectId: "p1",
        chat: { id: "c1", title: "T", type: "bug" },
        allChats: []
      })
    );
    await waitFor(() => expect(result.current.type).toBe("bug"));
  });
});
