import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchGithubStatus,
  startGithubOAuth,
  listGithubRepos,
  disconnectGithubOAuth
} from "./github-api";
import { ConnectProjectError } from "./projects-api";

describe("github-api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetchGithubStatus GETs status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        configured: true,
        connected: true,
        login: "octocat"
      })
    } as Response);
    const status = await fetchGithubStatus();
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/github/status",
      expect.any(Object)
    );
    expect(status.login).toBe("octocat");
  });

  it("startGithubOAuth returns authorize url", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "https://github.com/login/oauth/authorize" })
    } as Response);
    const url = await startGithubOAuth("/dashboard");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/github/oauth/start?returnTo=%2Fdashboard",
      expect.any(Object)
    );
    expect(url).toContain("github.com");
  });

  it("listGithubRepos passes q/page options", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        repos: [],
        page: 2,
        perPage: 30,
        hasMore: false
      })
    } as Response);
    const result = await listGithubRepos({ q: "forge", page: 2 });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/github/repos?q=forge&page=2",
      expect.any(Object)
    );
    expect(result.page).toBe(2);
  });

  it("disconnectGithubOAuth DELETEs oauth", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 204
    } as Response);
    await disconnectGithubOAuth();
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/github/oauth",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("throws ConnectProjectError on status failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: "nope" })
    } as Response);
    await expect(fetchGithubStatus()).rejects.toBeInstanceOf(
      ConnectProjectError
    );
  });
});
