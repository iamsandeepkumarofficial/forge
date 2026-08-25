import { describe, it, expect, vi } from "vitest";
import { saveTicketMetadataFields } from "./ticket-metadata-actions";

vi.mock("@/lib/projects-api", () => ({
  updateChat: vi.fn(async () => undefined),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  createLinkedItem: vi.fn(),
  deleteLinkedItem: vi.fn()
}));

describe("ticket-metadata-actions", () => {
  it("clears saving after save", async () => {
    const setSaving = vi.fn();
    await saveTicketMetadataFields({
      projectId: "p1",
      chatId: "c1",
      type: "feature",
      dueDate: "",
      parentId: "",
      setError: vi.fn(),
      setSaving
    });
    expect(setSaving).toHaveBeenCalledWith(true);
    expect(setSaving).toHaveBeenCalledWith(false);
  });
});
