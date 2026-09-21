import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  connectProject,
  connectLocalProject,
  fetchProjects,
  fetchProject,
  deleteProject
} from "./projects";
import { ConnectProjectError } from "./shared";

describe("projects API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("connectProject posts github url and returns ids", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projectId: "p1",
        workspaceId: "w1",
        alreadyConnected: false
      })
    } as Response);
    const result = await connectProject("octocat/hello");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/github",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ github: "octocat/hello" })
      })
    );
    expect(result.projectId).toBe("p1");
    expect(result.workspaceId).toBe("w1");
  });

  it("connectProject rejects empty github urls", async () => {
    await expect(connectProject("")).rejects.toMatchObject({
      code: "INVALID_GITHUB_URL"
    });
  });

  it("connectLocalProject posts localPath", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projectId: "p-local", workspaceId: "w-local" })
    } as Response);
    const result = await connectLocalProject("/tmp/my-repo");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ localPath: "/tmp/my-repo" })
      })
    );
    expect(result.projectId).toBe("p-local");
    expect(result.workspaceId).toBe("w-local");
  });

  it("connectLocalProject rejects empty paths", async () => {
    await expect(connectLocalProject("  ")).rejects.toMatchObject({
      code: "INVALID_LOCAL_PATH"
    });
  });

  it("fetchProjects GETs the projects list", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: "p1", name: "A", source: "github", status: "ready" }
      ]
    } as Response);
    const projects = await fetchProjects();
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:4000/api/projects");
    expect(projects).toHaveLength(1);
  });

  it("fetchProject requires an id and GETs the project", async () => {
    await expect(fetchProject("")).rejects.toBeInstanceOf(ConnectProjectError);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "p1",
        name: "A",
        source: "github",
        status: "ready"
      })
    } as Response);
    const project = await fetchProject("p1");
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:4000/api/projects/p1");
    expect(project.id).toBe("p1");
  });

  it("deleteProject DELETEs the project", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    await deleteProject("p1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
