import { describe, it, expect, vi } from "vitest";
import { submitNewChat } from "./new-chat-dialog-submit";

vi.mock("../lib/projects-api.js", () => ({
  createChat: vi.fn(async () => ({ id: "c1" })),
  createLinkedItem: vi.fn(),
  uploadAttachment: vi.fn()
}));

describe("submitNewChat", () => {
  it("errors when workflow is empty", async () => {
    const setError = vi.fn();
    await submitNewChat({
      projectId: "p1",
      title: "t",
      type: "feature",
      priority: "medium",
      dueDate: "",
      parentId: "",
      description: "",
      workflowId: "  ",
      files: [],
      links: [],
      onCreated: vi.fn(),
      onClose: vi.fn(),
      setError
    });
    expect(setError).toHaveBeenCalledWith("Select a workflow");
  });
});
