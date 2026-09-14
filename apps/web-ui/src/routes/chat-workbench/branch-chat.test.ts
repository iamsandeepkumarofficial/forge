import { describe, it, expect, vi } from "vitest";
import { createBranchedChat, readBranchCopyState } from "./branch-chat";
import { createWorkbenchSession } from "../../lib/projects-api.js";
import { createWorkspaceChat } from "../../lib/workspaces-api.js";

vi.mock("../../lib/projects-api.js", () => ({
  createWorkbenchSession: vi.fn()
}));
vi.mock("../../lib/workspaces-api.js", () => ({
  createWorkspaceChat: vi.fn()
}));

describe("createBranchedChat", () => {
  it("creates a workspace chat without copying yet", async () => {
    vi.mocked(createWorkspaceChat).mockResolvedValueOnce({
      id: "c2",
      sessionId: "s2",
      title: "Hello"
    });
    const created = await createBranchedChat({
      assistantText: "Hello there",
      projectId: "",
      workspaceId: "w1"
    });
    expect(createWorkspaceChat).toHaveBeenCalledWith({
      workspaceId: "w1",
      title: "Hello there"
    });
    expect(created).toEqual({
      href: "/workspaces/w1/chats/c2",
      targetSessionId: "s2"
    });
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
    const created = await createBranchedChat({
      assistantText: "Hi",
      projectId: "p1"
    });
    expect(created.href).toBe("/projects/p1/chats/c3");
    expect(created.targetSessionId).toBe("s3");
  });

  it("reads branch copy state from location", () => {
    expect(
      readBranchCopyState({
        branchCopy: {
          sourceSessionId: "s1",
          targetSessionId: "s2",
          untilMessageId: "m9"
        }
      })
    ).toEqual({
      sourceSessionId: "s1",
      targetSessionId: "s2",
      untilMessageId: "m9"
    });
    expect(readBranchCopyState({})).toBeNull();
  });
});
