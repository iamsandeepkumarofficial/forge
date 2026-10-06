import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const workspaceApi = vi.hoisted(() => ({
  listWorkspaces: vi.fn().mockResolvedValue([]),
  createWorkspace: vi.fn(),
  deleteWorkspace: vi.fn()
}));

vi.mock("../lib/tool-runner.js", () => ({
  runnerUrl: () => "http://127.0.0.1:4000"
}));
vi.mock("../lib/projects-api.js", () => ({
  deleteProject: vi.fn()
}));
vi.mock("../lib/workspaces-api.js", () => workspaceApi);
vi.mock("../components/dashboard-empty-state.js", () => ({
  DashboardEmptyState: () => <div>Empty state</div>
}));
vi.mock("../components/project-card.js", () => ({
  ProjectCard: ({ name }: { name: string }) => <div>{name}</div>
}));
vi.mock("../components/connect-project-dialog.js", () => ({
  ConnectProjectDialog: () => null
}));

import { Home } from "./home";

describe("Home", () => {
  beforeEach(() => {
    workspaceApi.listWorkspaces.mockReset().mockResolvedValue([]);
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

  it("lists workspaces and section-level connect cta", async () => {
    workspaceApi.listWorkspaces.mockResolvedValue([
      {
        id: "w1",
        userId: "u1",
        name: "Full stack",
        routes: [],
        createdAt: "",
        lastActivityAt: ""
      }
    ]);
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Full stack")).toBeTruthy();
      expect(screen.getByLabelText("Connect a project")).toBeTruthy();
      expect(screen.getByLabelText("Create a workspace")).toBeTruthy();
    });
  });
});
