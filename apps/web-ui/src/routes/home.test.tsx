import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Home } from "./home";

vi.mock("../lib/tool-runner.js", () => ({
  runnerUrl: () => "http://127.0.0.1:4000",
  pocToken: () => "tok"
}));
vi.mock("../lib/projects-api.js", () => ({
  deleteProject: vi.fn()
}));
vi.mock("../components/dashboard-empty-state.js", () => ({
  DashboardEmptyState: () => <div>Empty state</div>
}));
vi.mock("../components/project-card.js", () => ({
  ProjectCard: ({ name }: { name: string }) => <div>{name}</div>
}));
vi.mock("../components/connect-project-dialog.js", () => ({
  ConnectProjectDialog: () => null
}));

describe("Home", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => []
      })
    );
  });

  it("shows empty state when there are no workspaces", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Empty state")).toBeTruthy();
    });
  });

  it("lists workspaces when the API returns rows", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "p1",
          name: "Forge",
          source: "github",
          status: "available"
        }
      ]
    } as Response);
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Workspaces")).toBeTruthy();
      expect(screen.getByRole("button", { name: /Connect workspace/i })).toBeTruthy();
      expect(screen.getAllByText("Forge").length).toBeGreaterThan(0);
    });
  });
});
