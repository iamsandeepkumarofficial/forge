import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardEmptyState } from "./dashboard-empty-state";

vi.mock("../lib/desktop.js", () => ({
  isDesktop: () => false,
  pickFolder: vi.fn()
}));
vi.mock("../lib/projects-api.js", () => ({
  connectProject: vi.fn(),
  connectLocalProject: vi.fn(),
  createChat: vi.fn(),
  ConnectProjectError: class extends Error {}
}));
vi.mock("./github-repo-picker.js", () => ({
  GithubRepoPicker: () => null
}));

describe("DashboardEmptyState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders build prompt and import panels", () => {
    render(
      <MemoryRouter>
        <DashboardEmptyState onConnected={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText("Import Git Repository")).toBeTruthy();
    expect(screen.getByText(/Contact Form|Landing Page|REST API/)).toBeTruthy();
  });

  it("shows templates section", () => {
    render(
      <MemoryRouter>
        <DashboardEmptyState onConnected={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText("Chat Template")).toBeTruthy();
    expect(screen.getByText("Agent Pipeline")).toBeTruthy();
  });
});
