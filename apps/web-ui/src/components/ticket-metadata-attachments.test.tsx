import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TicketMetadataAttachments } from "./ticket-metadata-attachments";
import type { TicketMetadataState } from "./use-ticket-metadata-panel";

vi.mock("@/lib/projects-api", () => ({
  downloadAttachmentUrl: () => "#"
}));

const state = {
  attachments: [],
  projectId: "p1",
  chatId: "c1",
  onUpload: vi.fn(),
  removeAttachment: vi.fn()
} as unknown as TicketMetadataState;

describe("TicketMetadataAttachments", () => {
  it("shows empty attachments", () => {
    render(<TicketMetadataAttachments state={state} />);
    expect(screen.getByText("No attachments")).toBeTruthy();
  });
});
