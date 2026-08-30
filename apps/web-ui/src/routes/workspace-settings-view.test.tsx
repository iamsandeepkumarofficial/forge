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
const getWorkspaceHealth = vi.fn();
const listWorkspaceParameters = vi.fn();
const getWorkspaceDatabases = vi.fn();
const provisionWorkspaceDatabase = vi.fn();
const detachWorkspaceDatabase = vi.fn();
const getWorkspaceEnvironment = vi.fn();
const clearWorkspaceEnvironmentLaunch = vi.fn();
const clearWorkspaceEnvironmentDepsCache = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  getWorkspace: (...args: unknown[]) => getWorkspace(...args),
  addWorkspaceProject: (...args: unknown[]) => addWorkspaceProject(...args),
  updateWorkspace: (...args: unknown[]) => updateWorkspace(...args),
  removeWorkspaceProject: (...args: unknown[]) =>
    removeWorkspaceProject(...args),
  updateWorkspaceProject: (...args: unknown[]) =>
    updateWorkspaceProject(...args),
  deleteWorkspace: (...args: unknown[]) => deleteWorkspace(...args),
  getWorkspaceHealth: (...args: unknown[]) => getWorkspaceHealth(...args),
  analyzeWorkspace: vi.fn(),
  listWorkspaceChats: vi.fn().mockResolvedValue([]),
  createWorkspaceChat: vi.fn(),
  fetchWorkspaceChat: vi.fn(),
  listWorkspaceParameters: (...args: unknown[]) =>
    listWorkspaceParameters(...args),
  upsertWorkspaceParameter: vi.fn(),
  deleteWorkspaceParameter: vi.fn(),
  getWorkspaceDatabases: (...args: unknown[]) =>
    getWorkspaceDatabases(...args),
  provisionWorkspaceDatabase: (...args: unknown[]) =>
    provisionWorkspaceDatabase(...args),
  detachWorkspaceDatabase: (...args: unknown[]) =>
    detachWorkspaceDatabase(...args),
  getWorkspaceEnvironment: (...args: unknown[]) =>
    getWorkspaceEnvironment(...args),
  clearWorkspaceEnvironmentLaunch: (...args: unknown[]) =>
    clearWorkspaceEnvironmentLaunch(...args),
  clearWorkspaceEnvironmentDepsCache: (...args: unknown[]) =>
    clearWorkspaceEnvironmentDepsCache(...args)
}));

vi.mock("./workspace-setup-drawer.js", async () => {
  const actual = await vi.importActual<
    typeof import("./workspace-setup-drawer.js")
  >("./workspace-setup-drawer.js");
  return {
    ...actual,
    WorkspaceSetupDrawer: () => null
  };
});

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
    getWorkspaceHealth.mockResolvedValue({
      workspaceId: "w1",
      status: "ready",
      report: { findings: [] },
      computedAt: null
    });
    listWorkspaceParameters.mockResolvedValue([]);
    getWorkspaceEnvironment.mockResolvedValue({
      launch: { apps: [] },
      updatedAt: null,
      sourceSessionId: null,
      depsVolumeName: "forge-ws-deps-w1"
    });
    clearWorkspaceEnvironmentLaunch.mockResolvedValue(undefined);
    clearWorkspaceEnvironmentDepsCache.mockResolvedValue(undefined);
    getWorkspaceDatabases.mockResolvedValue({
      enabled: true,
      network: "forge",
      engines: [
        {
          id: "postgres",
          label: "PostgreSQL 16",
          image: "postgres:16",
          envKey: "DATABASE_URL",
          networkAlias: "postgres-apps",
          hostPort: 5434,
          engineRunning: false,
          attached: false,
          database: null
        },
        {
          id: "mongo",
          label: "MongoDB 7",
          image: "mongo:7",
          envKey: "MONGODB_URI",
          networkAlias: "mongo-apps",
          hostPort: 27017,
          engineRunning: false,
          attached: false,
          database: null
        }
      ]
    });
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
    expect(screen.getByText("Network plane")).toBeTruthy();

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
    fireEvent.click(screen.getByRole("button", { name: "Use suggested" }));
    expect(await screen.findByDisplayValue("/api")).toBeTruthy();
    expect(screen.getByDisplayValue("/")).toBeTruthy();
  });

  it("switches to Parameter store and Databases tabs", async () => {
    listWorkspaceParameters.mockResolvedValue([
      { key: "JWT_SECRET", value: "", secret: true, hasValue: false }
    ]);
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
    fireEvent.click(screen.getByRole("button", { name: "Parameter store" }));
    expect(await screen.findByText("JWT_SECRET")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Databases" }));
    expect(await screen.findByText("PostgreSQL 16")).toBeTruthy();
    expect(screen.getByText("MongoDB 7")).toBeTruthy();
    expect(screen.getAllByText(/Provision for workspace/).length).toBe(2);
  });

  it("shows Environment tab with saved launch and cache volume", async () => {
    getWorkspaceEnvironment.mockResolvedValue({
      launch: {
        apps: [
          {
            name: "web",
            cwd: "frontend",
            command: "yarn dev",
            type: "web",
            port: 3000,
            repo: "frontend"
          }
        ]
      },
      updatedAt: "2024-06-01T12:00:00.000Z",
      sourceSessionId: "sess-9",
      depsVolumeName: "forge-ws-deps-w1"
    });
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
    fireEvent.click(screen.getByRole("button", { name: "Environment" }));
    expect(await screen.findByText("Saved launch")).toBeTruthy();
    expect(screen.getAllByText("web").length).toBeGreaterThan(0);
    expect(screen.getByText(/forge-ws-deps-w1/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Clear saved launch" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Clear package cache" })
    ).toBeTruthy();
  });

  it("shows Analyze CTA when healthy and Fix when findings exist", async () => {
    getWorkspaceHealth.mockResolvedValue({
      workspaceId: "w1",
      status: "ready",
      report: { findings: [] },
      computedAt: null
    });
    const { unmount } = render(
      <MemoryRouter initialEntries={["/workspaces/w1/settings"]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId/settings"
            element={<WorkspaceSettingsView />}
          />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole("button", { name: "Analyze" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Fix$/ })).toBeNull();
    unmount();

    getWorkspaceHealth.mockResolvedValue({
      workspaceId: "w1",
      status: "warnings",
      report: {
        findings: [
          {
            code: "missing-env-key",
            severity: "warning",
            message: "JWT_SECRET missing"
          }
        ]
      },
      computedAt: null
    });
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
    expect(await screen.findByRole("button", { name: "Fix" })).toBeTruthy();
  });
});
