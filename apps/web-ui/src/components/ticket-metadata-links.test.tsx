import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TicketMetadataLinks } from "./ticket-metadata-links";
import type { TicketMetadataState } from "./use-ticket-metadata-panel";

const state = {
  links: [],
  linkLabel: "",
  setLinkLabel: vi.fn(),
  linkUrl: "",
  setLinkUrl: vi.fn(),
  onAddLink: vi.fn(),
  removeLink: vi.fn()
} as unknown as TicketMetadataState;

describe("TicketMetadataLinks", () => {
  it("shows empty linked items", () => {
    render(<TicketMetadataLinks state={state} />);
    expect(screen.getByText("No linked items")).toBeTruthy();
  });
});
