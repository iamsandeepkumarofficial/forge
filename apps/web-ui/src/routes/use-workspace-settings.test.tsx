import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useWorkspaceSettings } from "./use-workspace-settings";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";
import type { ProjectSummary } from "../lib/projects-api.js";

const getWorkspaceHealth = vi.fn();
const removeProjectMember = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  getWorkspaceHealth: (...args: unknown[]) => getWorkspaceHealth(...args)
}));

vi.mock("./workspace-members-actions.js", () => ({
  addSelectedProjects: vi.fn(),
  removeProjectMember: (...args: unknown[]) => removeProjectMember(...args),
  saveMemberDepends: vi.fn()
}));

vi.mock("./workspace-routes-actions.js", () => ({
  saveWorkspaceRoutes: vi.fn(),
  deleteWorkspaceById: vi.fn()
}));

const workspace: WorkspaceDetail = {
  id: "w1",
  userId: "u1",
  name: "Demo",
  routes: [],
  createdAt: "",
  lastActivityAt: "",
  members: [
    {
      id: "m1",
      workspaceId: "w1",
      projectId: "p1",
      repoName: "web",
      sortOrder: 0,
      dependsOn: [],
      env: {},
      createdAt: "",
      project: {
        id: "p1",
        name: "web",
        source: "local",
        dedupeKey: "web",
        status: "ready"
      }
    }
  ]
};

const projects: ProjectSummary[] = [
  { id: "p1", name: "web", source: "local", status: "ready" },
  { id: "p2", name: "api", source: "local", status: "ready" }
];

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useWorkspaceSettings", () => {
  it("composes health, tab, members, and routes", async () => {
    getWorkspaceHealth.mockResolvedValue({
      status: "ok",
      report: { findings: [] }
    });
    const { result } = renderHook(
      () =>
        useWorkspaceSettings({
          workspaceId: "w1",
          workspace,
          projects,
          busy: false,
          setBusy: vi.fn(),
          setError: vi.fn(),
          setWorkspace: vi.fn()
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.healthStatus).toBe("ok"));
    expect(result.current.tab).toBe("overview");
    expect(result.current.available.map((p) => p.id)).toEqual(["p2"]);
    act(() => {
      result.current.setTab("parameters");
    });
    expect(result.current.tab).toBe("parameters");
  });

  it("resets routes dirty when removing a member", async () => {
    getWorkspaceHealth.mockResolvedValue({
      status: "ok",
      report: { findings: [] }
    });
    removeProjectMember.mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        useWorkspaceSettings({
          workspaceId: "w1",
          workspace,
          projects,
          busy: false,
          setBusy: vi.fn(),
          setError: vi.fn(),
          setWorkspace: vi.fn()
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.healthStatus).toBe("ok"));
    act(() => {
      result.current.applySuggestedFromMembers();
    });
    await waitFor(() => expect(result.current.routesDirty).toBe(true));
    act(() => {
      result.current.onRemoveMember("p1");
    });
    await waitFor(() => expect(result.current.routesDirty).toBe(false));
    expect(removeProjectMember).toHaveBeenCalled();
  });
});
