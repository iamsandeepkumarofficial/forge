import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceSettingsView } from "./workspace-settings-view";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";

const getWorkspace = vi.fn();
const addWorkspaceProject = vi.fn();
const updateWorkspace = vi.fn();
const removeWorkspaceProject = vi.fn();
const updateWorkspaceProject = vi.fn();
const deleteWorkspace = vi.fn();
const fetchProjects = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  getWorkspace: (...args: unknown[]) => getWorkspace(...args),
  addWorkspaceProject: (...args: unknown[]) => addWorkspaceProject(...args),
  updateWorkspace: (...args: unknown[]) => updateWorkspace(...args),
  removeWorkspaceProject: (...args: unknown[]) =>
    removeWorkspaceProject(...args),
  updateWorkspaceProject: (...args: unknown[]) =>
    updateWorkspaceProject(...args),
  deleteWorkspace: (...args: unknown[]) => deleteWorkspace(...args)
}));

vi.mock("../lib/projects-api.js", () => ({
  fetchProjects: (...args: unknown[]) => fetchProjects(...args)
}));

function emptyWorkspace(overrides?: Partial<WorkspaceDetail>): WorkspaceDetail {
  return {
    id: "w1",
    userId: "u1",
    name: "Demo Forge",
    routes: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    lastActivityAt: "2024-01-01T00:00:00.000Z",
    members: [],
    ...overrides
  };
}

describe("WorkspaceSettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspace.mockResolvedValue(emptyWorkspace());
    fetchProjects.mockResolvedValue([
      { id: "p1", name: "frontend", source: "local", status: "available" },
      { id: "p2", name: "backend", source: "github", status: "available" }
    ]);
    addWorkspaceProject.mockImplementation(
      async (_id: string, input: { projectId: string }) => {
        const current = (await getWorkspace.mock.results[
          getWorkspace.mock.results.length - 1
        ]?.value) as WorkspaceDetail;
        const project = (
          await fetchProjects.mock.results[0]?.value
        ) as Array<{
          id: string;
          name: string;
          source: string;
          status: string;
        }>;
        const row = project.find((p) => p.id === input.projectId)!;
        return emptyWorkspace({
          ...current,
          members: [
            ...current.members,
            {
              id: `m-${input.projectId}`,
              workspaceId: "w1",
              projectId: input.projectId,
              repoName: row.name,
              sortOrder: current.members.length,
              dependsOn: [],
              env: {},
              createdAt: "2024-01-01T00:00:00.000Z",
              project: {
                id: row.id,
                name: row.name,
                source: row.source,
                dedupeKey: row.id,
                status: row.status
              }
            }
          ]
        });
      }
    );
  });

  it("multi-selects projects and adds them", async () => {
    render(
      <MemoryRouter initialEntries={["/workspaces/w1/settings"]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId/settings"
            element={<WorkspaceSettingsView />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Demo Forge")).toBeTruthy();
    expect(screen.getByText("Preview routing")).toBeTruthy();

    fireEvent.click(screen.getByText("frontend"));
    fireEvent.click(screen.getByText("backend"));
    fireEvent.click(screen.getByRole("button", { name: /Add selected/i }));

    await waitFor(() => {
      expect(addWorkspaceProject).toHaveBeenCalledTimes(2);
    });
    expect(addWorkspaceProject).toHaveBeenCalledWith("w1", {
      projectId: "p1"
    });
    expect(addWorkspaceProject).toHaveBeenCalledWith("w1", {
      projectId: "p2"
    });
  });

  it("renders routing rows and saves", async () => {
    getWorkspace.mockResolvedValue(
      emptyWorkspace({
        members: [
          {
            id: "m1",
            workspaceId: "w1",
            projectId: "p1",
            repoName: "frontend",
            sortOrder: 0,
            dependsOn: [],
            env: {},
            createdAt: "2024-01-01T00:00:00.000Z",
            project: {
              id: "p1",
              name: "frontend",
              source: "local",
              dedupeKey: "p1",
              status: "available"
            }
          }
        ],
        routes: [{ pathPrefix: "/", target: "frontend" }]
      })
    );
    updateWorkspace.mockResolvedValue(
      emptyWorkspace({
        routes: [{ pathPrefix: "/api", target: "frontend" }]
      })
    );

    render(
      <MemoryRouter initialEntries={["/workspaces/w1/settings"]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId/settings"
            element={<WorkspaceSettingsView />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue("/")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("/"), {
      target: { value: "/api" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Save routes/i }));

    await waitFor(() => {
      expect(updateWorkspace).toHaveBeenCalledWith("w1", {
        routes: [{ pathPrefix: "/api", target: "frontend" }]
      });
    });
  });

  it("shows suggested routes when none are configured", async () => {
    getWorkspace.mockResolvedValue(
      emptyWorkspace({
        members: [
          {
            id: "m1",
            workspaceId: "w1",
            projectId: "p1",
            repoName: "bp-frontend",
            sortOrder: 0,
            dependsOn: [],
            env: {},
            createdAt: "2024-01-01T00:00:00.000Z",
            project: {
              id: "p1",
              name: "bp-frontend",
              source: "local",
              dedupeKey: "p1",
              status: "available"
            }
          },
          {
            id: "m2",
            workspaceId: "w1",
            projectId: "p2",
            repoName: "bp-backend",
            sortOrder: 1,
            dependsOn: [],
            env: {},
            createdAt: "2024-01-01T00:00:00.000Z",
            project: {
              id: "p2",
              name: "bp-backend",
              source: "local",
              dedupeKey: "p2",
              status: "available"
            }
          }
        ],
        routes: []
      })
    );

    render(
      <MemoryRouter initialEntries={["/workspaces/w1/settings"]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId/settings"
            element={<WorkspaceSettingsView />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Suggested routes")).toBeTruthy();
    expect(screen.getByText("/api")).toBeTruthy();
    expect(screen.getAllByText("bp-backend").length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: /Use suggested routes/i })
    );
    expect(await screen.findByDisplayValue("/api")).toBeTruthy();
    expect(screen.getByDisplayValue("/")).toBeTruthy();
  });
});
