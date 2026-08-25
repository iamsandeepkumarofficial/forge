import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  NewChatMetaFields,
  NewChatTypePriorityFields
} from "./new-chat-dialog-meta";
import type { NewChatDialogState } from "./use-new-chat-dialog";

const state = {
  type: "feature",
  setType: vi.fn(),
  priority: "medium",
  setPriority: vi.fn(),
  workflowId: "sdlc",
  setWorkflowId: vi.fn(),
  workflows: [],
  dueDate: "",
  setDueDate: vi.fn(),
  parentId: "",
  setParentId: vi.fn(),
  parentOptions: []
} as unknown as NewChatDialogState;

describe("new-chat-dialog-meta", () => {
  it("renders type select", () => {
    render(<NewChatTypePriorityFields state={state} />);
    expect(screen.getByLabelText("Type")).toBeTruthy();
  });

  it("renders workflow select", () => {
    render(<NewChatMetaFields state={state} />);
    expect(screen.getByLabelText("Workflow")).toBeTruthy();
  });
});
