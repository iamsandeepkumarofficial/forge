import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GithubRepoPickerView } from "./github-repo-picker-view";

describe("GithubRepoPickerView", () => {
  it("renders authorize CTA when disconnected", () => {
    render(
      <GithubRepoPickerView
        state={{
          title: "Connect GitHub",
          statusLogin: null,
          configured: true,
          error: null,
          busy: false,
          authorizing: false,
          query: "",
          setQuery: vi.fn(),
          repos: [],
          loading: false,
          hasMore: false,
          page: 1,
          authorize: vi.fn(),
          loadRepos: vi.fn(),
          disconnect: vi.fn()
        }}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/Authorize with GitHub/i)).toBeTruthy();
  });
});
