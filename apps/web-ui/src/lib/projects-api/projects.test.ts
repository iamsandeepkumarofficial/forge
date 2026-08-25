import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  connectProject,
  fetchProjects,
  fetchProject,
  deleteProject,
  uploadProject
} from "./projects";
import { ConnectProjectError } from "./shared";

describe("projects API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("connectProject posts github url and returns ids", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projectId: "p1", alreadyConnected: false })
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
  });

  it("connectProject rejects empty github urls", async () => {
    await expect(connectProject("")).rejects.toMatchObject({
      code: "INVALID_GITHUB_URL"
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
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer/)
        })
      })
    );
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
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1",
      expect.any(Object)
    );
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

  it("uploadProject rejects non-zip files", async () => {
    const file = new File(["x"], "notes.txt", { type: "text/plain" });
    await expect(uploadProject(file)).rejects.toMatchObject({
      code: "INVALID_FILE_TYPE"
    });
  });

  it("uploadProject posts FormData for zip files", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projectId: "p2" })
    } as Response);
    const file = new File(["zip"], "app.zip", { type: "application/zip" });
    const result = await uploadProject(file);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/upload",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.projectId).toBe("p2");
  });
});
