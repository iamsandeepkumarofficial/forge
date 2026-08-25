import { describe, it, expect, vi } from "vitest";
import { loadChatSessions, startWorkbenchChat } from "./chats-page-actions";

vi.mock("../lib/projects-api.js", () => ({
  createWorkbenchSession: vi.fn(async () => ({ id: "s1", title: "t" })),
  deleteChat: vi.fn(),
  fetchWorkbenchSessions: vi.fn(async () => [{ id: "s1", title: "Chat" }])
}));

describe("chats-page-actions", () => {
  it("loads sessions for a project", async () => {
    const setSessions = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();
    await loadChatSessions({
      projectId: "p1",
      setLoading,
      setSessions,
      setError
    });
    expect(setSessions).toHaveBeenCalled();
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it("skips start when prompt is empty", async () => {
    const navigate = vi.fn();
    await startWorkbenchChat({
      projectId: "p1",
      creating: false,
      text: "   ",
      navigate,
      setCreating: vi.fn(),
      setError: vi.fn()
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});
