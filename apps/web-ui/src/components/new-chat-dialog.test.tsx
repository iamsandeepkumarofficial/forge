import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewChatDialog } from "./new-chat-dialog";

vi.mock("./use-new-chat-dialog.js", () => ({
  useNewChatDialog: () => ({
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
  })
}));

describe("NewChatDialog", () => {
  it("renders dialog title", () => {
    render(
      <NewChatDialog
        projectId="p1"
        existingChats={[]}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );
    expect(screen.getByText("New ticket")).toBeTruthy();
  });
});
