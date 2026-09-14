import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createWorkspace,
  deleteWorkspace,
  deleteWorkspaceParameter,
  getWorkspace,
  listWorkspaces,
  updateWorkspaceProject
} from "./workspaces-api";

describe("workspaces-api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("lists workspaces from the API", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        workspaces: [{ id: "w1", name: "Main", routes: [] }]
      })
    } as Response);
    const rows = await listWorkspaces();
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:4000/api/workspaces");
    expect(rows).toEqual([{ id: "w1", name: "Main", routes: [] }]);
  });

  it("fetches a workspace detail", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "w1", name: "Main", members: [] })
    } as Response);
    const detail = await getWorkspace("w1");
    expect(detail.id).toBe("w1");
    expect(detail.members).toEqual([]);
  });

  it("creates a workspace with a name", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "w2", name: "New", members: [] })
    } as Response);
    const created = await createWorkspace("New");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/workspaces",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "New" })
      })
    );
    expect(created.name).toBe("New");
  });

  it("treats HTTP 204 as success for deleteWorkspace", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 204,
      statusText: "No Content"
    } as Response);
    await expect(deleteWorkspace("w1")).resolves.toBeUndefined();
  });

  it("patches a workspace project via options object", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "w1",
        members: [{ projectId: "p1", dependsOn: ["api"] }]
      })
    } as Response);
    const detail = await updateWorkspaceProject({
      workspaceId: "w1",
      projectId: "p1",
      patch: { dependsOn: ["api"] }
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/workspaces/w1/projects/p1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ dependsOn: ["api"] })
      })
    );
    expect(detail.members[0]?.dependsOn).toEqual(["api"]);
  });

  it("treats HTTP 204 as success for deleteWorkspaceParameter", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 204,
      statusText: "No Content"
    } as Response);
    await expect(
      deleteWorkspaceParameter("w1", "JWT_SECRET")
    ).resolves.toBeUndefined();
  });
});
