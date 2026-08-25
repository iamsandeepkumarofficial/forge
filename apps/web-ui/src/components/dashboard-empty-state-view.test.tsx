import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardEmptyStateView } from "./dashboard-empty-state-view";

describe("DashboardEmptyStateView", () => {
  it("renders the build prompt", () => {
    const state = {
      buildText: "",
      setBuildText: vi.fn(),
      pendingTitle: "",
      suggestions: ["Contact Form"],
      showGithubPicker: false,
      setShowGithubPicker: vi.fn(),
      connectingSlug: null,
      buildHint: false,
      loading: null,
      error: null,
      setError: vi.fn(),
      dragOver: false,
      setDragOver: vi.fn(),
      setSuggestionSet: vi.fn(),
      busy: false,
      handleBuild: vi.fn(),
      handleGithubSelect: vi.fn(),
      onDrop: vi.fn()
    };
    render(
      <MemoryRouter>
        <DashboardEmptyStateView
          state={state as never}
          onImportSectionRef={vi.fn()}
          onChooseZip={vi.fn()}
          onChooseFolder={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText(/I want to build/i)).toBeTruthy();
  });
});
