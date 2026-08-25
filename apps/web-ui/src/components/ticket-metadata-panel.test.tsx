import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TicketMetadataPanel } from "./ticket-metadata-panel";

vi.mock("./use-ticket-metadata-panel.js", () => ({
  useTicketMetadataPanel: () => ({
    type: "feature",
    setType: vi.fn(),
    dueDate: "",
    setDueDate: vi.fn(),
    parentId: "",
    setParentId: vi.fn(),
    attachments: [],
    links: [],
    linkLabel: "",
    setLinkLabel: vi.fn(),
    linkUrl: "",
    setLinkUrl: vi.fn(),
    error: null,
    saving: false,
    parentOptions: [],
    projectId: "p1",
    chatId: "c1",
    saveFields: vi.fn(),
    onUpload: vi.fn(),
    onAddLink: vi.fn(),
    removeAttachment: vi.fn(),
    removeLink: vi.fn()
  })
}));

describe("TicketMetadataPanel", () => {
  it("renders details heading by default", () => {
    render(
      <TicketMetadataPanel
        projectId="p1"
        chat={{ id: "c1", title: "T", type: "feature" }}
        allChats={[]}
      />
    );
    expect(screen.getByText("Details")).toBeTruthy();
  });
});
