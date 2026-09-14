import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardEmptyStateView } from "./dashboard-empty-state-view";

describe("DashboardEmptyStateView", () => {
  it("renders the build prompt and local folder cta", () => {
    const state = {
      buildText: "",
      setBuildText: vi.fn(),
      pendingTitle: "",
      suggestions: ["Contact Form"],
      buildHint: false,
      loading: null,
      error: null,
      setError: vi.fn(),
      desktop: false,
      showPathInput: true,
      localPath: "",
      setLocalPath: vi.fn(),
      setSuggestionSet: vi.fn(),
      busy: false,
      handleBuild: vi.fn(),
      handleSelectFolder: vi.fn(),
      handleConnectPath: vi.fn()
    };
    const onShowActivity = vi.fn();
    render(
      <MemoryRouter>
        <DashboardEmptyStateView
          state={state as never}
          onImportSectionRef={vi.fn()}
          onShowActivity={onShowActivity}
        />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText(/I want to build/i)).toBeTruthy();
    expect(screen.getByLabelText("Select folder")).toBeTruthy();
    expect(screen.getByLabelText("Settings")).toBeTruthy();
    expect(screen.getByLabelText("Activity")).toBeTruthy();
    expect(screen.queryByText(/Workspaces/i)).toBeNull();
  });
});
