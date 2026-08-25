import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  NewChatAttachmentsSection,
  NewChatLinksSection
} from "./new-chat-dialog-extras";
import type { NewChatDialogState } from "./use-new-chat-dialog";

const state = {
  files: [],
  setFiles: vi.fn(),
  links: [],
  setLinks: vi.fn(),
  linkLabel: "",
  setLinkLabel: vi.fn(),
  linkUrl: "",
  setLinkUrl: vi.fn(),
  addLink: vi.fn()
} as unknown as NewChatDialogState;

describe("new-chat-dialog-extras", () => {
  it("renders attachments empty hint", () => {
    render(<NewChatAttachmentsSection state={state} />);
    expect(screen.getByText(/Optional/)).toBeTruthy();
  });

  it("renders linked work items label", () => {
    render(<NewChatLinksSection state={state} />);
    expect(screen.getByText(/Linked work items/)).toBeTruthy();
  });
});
