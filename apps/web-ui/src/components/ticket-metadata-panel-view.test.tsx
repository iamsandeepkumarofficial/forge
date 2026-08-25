import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TicketMetadataPanelView } from "./ticket-metadata-panel-view";
import type { TicketMetadataState } from "./use-ticket-metadata-panel";

const state = {
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
} as unknown as TicketMetadataState;

describe("TicketMetadataPanelView", () => {
  it("renders save fields", () => {
    render(<TicketMetadataPanelView state={state} hideHeading={false} />);
    expect(screen.getByText("Save fields")).toBeTruthy();
  });
});
