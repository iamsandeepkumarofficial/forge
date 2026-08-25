import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewChatDialogFields } from "./new-chat-dialog-fields";
import type { NewChatDialogState } from "./use-new-chat-dialog";

const state = {
  title: "Hello",
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
  parentOptions: [],
  addLink: vi.fn()
} as unknown as NewChatDialogState;

describe("NewChatDialogFields", () => {
  it("shows the title value", () => {
    render(<NewChatDialogFields state={state} />);
    expect(screen.getByDisplayValue("Hello")).toBeTruthy();
  });
});
