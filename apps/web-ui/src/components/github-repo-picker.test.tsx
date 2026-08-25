import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GithubRepoPicker } from "./github-repo-picker";

vi.mock("../lib/github-api.js", () => ({
  disconnectGithubOAuth: vi.fn(),
  fetchGithubStatus: vi.fn(),
  listGithubRepos: vi.fn(),
  openGithubOAuthPopup: vi.fn(),
  startGithubOAuth: vi.fn()
}));
vi.mock("../lib/projects-api.js", () => ({
  ConnectProjectError: class extends Error {
    help?: string;
  }
}));

import { fetchGithubStatus, listGithubRepos } from "../lib/github-api.js";

describe("GithubRepoPicker", () => {
  beforeEach(() => {
    vi.mocked(fetchGithubStatus).mockResolvedValue({
      configured: true,
      connected: true,
      login: "octocat"
    });
    vi.mocked(listGithubRepos).mockResolvedValue({
      repos: [
        {
          id: 1,
          fullName: "octocat/hello",
          name: "hello",
          ownerLogin: "octocat",
          private: false,
          description: "demo",
          htmlUrl: "https://github.com/octocat/hello",
          updatedAt: null,
          defaultBranch: "main"
        }
      ],
      page: 1,
      perPage: 30,
      hasMore: false
    });
  });

  it("lists repos and selects one", async () => {
    const onSelect = vi.fn();
    render(<GithubRepoPicker open onClose={vi.fn()} onSelect={onSelect} />);
    await waitFor(() => {
      expect(screen.getByText("octocat/hello")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("octocat/hello"));
    expect(onSelect).toHaveBeenCalledWith("octocat/hello");
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <GithubRepoPicker open={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
