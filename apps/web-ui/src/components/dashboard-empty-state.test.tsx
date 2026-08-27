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

describe("DashboardEmptyState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders build prompt, local folder import, and templates", () => {
    render(
      <MemoryRouter>
        <DashboardEmptyState onConnected={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText("Select a project folder")).toBeTruthy();
    expect(screen.getByText(/Contact Form|Landing Page|REST API/)).toBeTruthy();
    expect(screen.getByText("Chat Template")).toBeTruthy();
    expect(screen.getByText("Agent Pipeline")).toBeTruthy();
  });
});
