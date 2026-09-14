import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runnerUrl,
  fetchRunnerRepos,
  connectGithubRepo,
  prepareSessionWorkspace,
  executeTool,
  listSandboxDir
} from "./tool-runner";

describe("tool-runner", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("runnerUrl defaults to local runner", () => {
    expect(runnerUrl()).toMatch(/127\.0\.0\.1:4000/);
  });

  it("fetchRunnerRepos GETs internal repos", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ managedRoot: "/tmp", repos: ["app"] })
    } as Response);
    const result = await fetchRunnerRepos();
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/internal/repos",
      expect.objectContaining({ method: "GET" })
    );
    expect(result.repos).toEqual(["app"]);
  });

  it("connectGithubRepo POSTs slug options", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ path: "/repos/a", alreadyExisted: false })
    } as Response);
    const result = await connectGithubRepo({
      slug: "octocat/hello",
      shallow: true
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/internal/repos/github",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ slug: "octocat/hello", shallow: true })
      })
    );
    expect(result.path).toBe("/repos/a");
  });

  it("prepareSessionWorkspace POSTs sessionId", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionRoot: "/s1" })
    } as Response);
    expect((await prepareSessionWorkspace("s1")).sessionRoot).toBe("/s1");
  });

  it("executeTool POSTs tool payload and listSandboxDir filters entries", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        output: "ok",
        metadata: {
          entries: [
            { name: "a.ts", path: "a.ts", isDir: false },
            { name: "bad", path: "bad" }
          ]
        }
      })
    } as Response);
    const result = await executeTool({
      sessionId: "s1",
      toolName: "list_dir",
      args: { path: "." }
    });
    expect(result.success).toBe(true);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        output: "",
        metadata: {
          entries: [
            { name: "a.ts", path: "a.ts", isDir: false },
            { name: "bad", path: "bad" }
          ]
        }
      })
    } as Response);
    const entries = await listSandboxDir({ sessionId: "s1", path: "." });
    expect(entries).toEqual([{ name: "a.ts", path: "a.ts", isDir: false }]);
  });

  it("listSandboxDir throws when list_dir fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        output: "Invalid path: first segment must be a member repo"
      })
    } as Response);
    await expect(
      listSandboxDir({ sessionId: "s1", path: "src" })
    ).rejects.toThrow(/member repo/);
  });
});
