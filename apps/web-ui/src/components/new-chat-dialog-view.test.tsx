import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewChatDialogView } from "./new-chat-dialog-view";
import type { NewChatDialogState } from "./use-new-chat-dialog";

const state = {
  onClose: vi.fn(),
  title: "",
  setTitle: vi.fn(),
  type: "feature",
  setType: vi.fn(),
  priority: "medium",
  setPriority: vi.fn(),
  dueDate: "",
  setDueDate: vi.fn(),
  parentId: "",
  setParentId: vi.fn(),
  description: "",
  setDescription: vi.fn(),
  workflowId: "sdlc",
  setWorkflowId: vi.fn(),
  workflows: [],
  files: [],
  setFiles: vi.fn(),
  links: [],
  setLinks: vi.fn(),
  linkLabel: "",
  setLinkLabel: vi.fn(),
  linkUrl: "",
  setLinkUrl: vi.fn(),
  loading: false,
  error: null,
  parentOptions: [],
  addLink: vi.fn(),
  handleSubmit: vi.fn()
} as unknown as NewChatDialogState;

describe("NewChatDialogView", () => {
  it("renders create ticket action", () => {
    render(<NewChatDialogView state={state} />);
    expect(screen.getByText("Create ticket")).toBeTruthy();
  });
});
