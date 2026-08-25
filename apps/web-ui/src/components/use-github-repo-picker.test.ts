import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGithubRepoPicker } from "./use-github-repo-picker";

vi.mock("../lib/github-api.js", () => ({
  disconnectGithubOAuth: vi.fn(),
  fetchGithubStatus: vi.fn(),
  listGithubRepos: vi.fn(),
  openGithubOAuthPopup: vi.fn(),
  startGithubOAuth: vi.fn()
}));

vi.mock("./github-repo-picker-api.js", () => ({
  authorizeGithub: vi.fn(),
  bootstrapGithubStatus: vi.fn(),
  fetchGithubRepoPage: vi.fn(),
  githubErrorMessage: (e: unknown) => String(e)
}));

describe("useGithubRepoPicker", () => {
  it("starts closed without busy state", () => {
    const { result } = renderHook(() => useGithubRepoPicker({ open: false }));
    expect(result.current.busy).toBe(false);
    expect(result.current.title).toBe("Connect GitHub");
  });
});
