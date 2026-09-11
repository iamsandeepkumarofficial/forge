import { describe, it, expect, vi, beforeEach } from "vitest";
import { branchChatFromMessage } from "./branch-chat";
import { copySessionMessagesUntil } from "../../lib/chat-agent.js";
import { createWorkbenchSession } from "../../lib/projects-api.js";
import { createWorkspaceChat } from "../../lib/workspaces-api.js";

vi.mock("../../lib/chat-agent.js", () => ({
  copySessionMessagesUntil: vi.fn(async () => undefined)
}));
vi.mock("../../lib/projects-api.js", () => ({
  createWorkbenchSession: vi.fn()
}));
vi.mock("../../lib/workspaces-api.js", () => ({
  createWorkspaceChat: vi.fn()
}));

describe("branchChatFromMessage", () => {
  beforeEach(() => {
    vi.mocked(copySessionMessagesUntil).mockClear();
  });

  it("creates a workspace chat and copies history", async () => {
    vi.mocked(createWorkspaceChat).mockResolvedValueOnce({
      id: "c2",
      sessionId: "s2",
      title: "Hello"
    });
    const href = await branchChatFromMessage({
      sourceSessionId: "s1",
      untilMessageId: "m9",
      assistantText: "Hello there",
      projectId: "",
      workspaceId: "w1"
    });
    expect(createWorkspaceChat).toHaveBeenCalledWith({
      workspaceId: "w1",
      title: "Hello there"
    });
    expect(copySessionMessagesUntil).toHaveBeenCalledWith({
      sourceSessionId: "s1",
      targetSessionId: "s2",
      untilMessageId: "m9"
    });
    expect(href).toBe("/workspaces/w1/chats/c2");
  });

  it("creates a project workbench chat when no workspace is set", async () => {
    vi.mocked(createWorkbenchSession).mockResolvedValueOnce({
      id: "c3",
      projectId: "p1",
      userId: "u1",
      title: "Hi",
      kind: "workbench",
      sessionId: "s3",
      branchName: "wb/s3",
      lastActivityAt: "2026-01-01T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z"
    });
    const href = await branchChatFromMessage({
      sourceSessionId: "s1",
      untilMessageId: "m2",
      assistantText: "Hi",
      projectId: "p1"
    });
    expect(href).toBe("/projects/p1/chats/c3");
    expect(copySessionMessagesUntil).toHaveBeenCalledWith({
      sourceSessionId: "s1",
      targetSessionId: "s3",
      untilMessageId: "m2"
    });
  });
});
