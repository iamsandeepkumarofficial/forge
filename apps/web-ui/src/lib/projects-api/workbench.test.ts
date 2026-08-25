import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWorkbenchSession, fetchWorkbenchSessions } from "./workbench";
import { ConnectProjectError } from "./shared";

describe("workbench API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("createWorkbenchSession POSTs optional title", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "w1",
        projectId: "p1",
        userId: "u1",
        title: "Scratch",
        kind: "workbench",
        sessionId: "s1",
        branchName: "wb/s1",
        lastActivityAt: "2026-01-01T00:00:00Z",
        createdAt: "2026-01-01T00:00:00Z"
      })
    } as Response);
    const session = await createWorkbenchSession("p1", "Scratch");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/workbench-sessions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Scratch" })
      })
    );
    expect(session.kind).toBe("workbench");
  });

  it("fetchWorkbenchSessions GETs sessions", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => []
    } as Response);
    const sessions = await fetchWorkbenchSessions("p1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/workbench-sessions",
      expect.any(Object)
    );
    expect(sessions).toEqual([]);
  });

  it("throws ConnectProjectError on failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    await expect(fetchWorkbenchSessions("p1")).rejects.toBeInstanceOf(
      ConnectProjectError
    );
  });
});
