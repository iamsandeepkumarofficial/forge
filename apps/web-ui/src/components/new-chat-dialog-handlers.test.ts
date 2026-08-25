import { describe, it, expect, vi } from "vitest";
import { buildNewChatSubmitHandler } from "./new-chat-dialog-handlers";

vi.mock("./new-chat-dialog-submit.js", () => ({
  submitNewChat: vi.fn(async () => undefined)
}));

describe("buildNewChatSubmitHandler", () => {
  it("toggles loading around submit", async () => {
    const setLoading = vi.fn();
    const handler = buildNewChatSubmitHandler({
      projectId: "p1",
      title: "t",
      type: "feature",
      priority: "medium",
      dueDate: "",
      parentId: "",
      description: "",
      workflowId: "sdlc",
      files: [],
      links: [],
      onCreated: vi.fn(),
      onClose: vi.fn(),
      setError: vi.fn(),
      setLoading
    });
    await handler({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(setLoading).toHaveBeenCalledWith(false);
  });
});
