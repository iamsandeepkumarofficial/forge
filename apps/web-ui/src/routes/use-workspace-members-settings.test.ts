import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkspaceMembersSettings } from "./use-workspace-members-settings";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";
import type { ProjectSummary } from "../lib/projects-api.js";

const addSelectedProjects = vi.fn();
const removeProjectMember = vi.fn();
const saveMemberDepends = vi.fn();

vi.mock("./workspace-members-actions.js", () => ({
  addSelectedProjects: (...args: unknown[]) => addSelectedProjects(...args),
  removeProjectMember: (...args: unknown[]) => removeProjectMember(...args),
  saveMemberDepends: (...args: unknown[]) => saveMemberDepends(...args)
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
      repoName: "p1",
      sortOrder: 0,
      dependsOn: [],
      env: {},
      createdAt: "",
      project: {
        id: "p1",
        name: "p1",
        source: "local",
        dedupeKey: "p1",
        status: "ready"
      }
    }
  ]
};

const projects: ProjectSummary[] = [
  { id: "p1", name: "p1", source: "local", status: "ready" },
  { id: "p2", name: "p2", source: "local", status: "ready" }
];

describe("useWorkspaceMembersSettings", () => {
  beforeEach(() => {
    addSelectedProjects.mockReset();
    removeProjectMember.mockReset();
    saveMemberDepends.mockReset();
  });

  it("exposes available projects and selection toggle", () => {
    const { result } = renderHook(() =>
      useWorkspaceMembersSettings({
        workspaceId: "w1",
        workspace,
        projects,
        busy: false,
        setBusy: vi.fn(),
        setWorkspace: vi.fn(),
        onRoutesSuggested: vi.fn()
      })
    );
    expect(result.current.available.map((p) => p.id)).toEqual(["p2"]);
    act(() => {
      result.current.toggleSelected("p2");
    });
    expect([...result.current.selectedIds]).toEqual(["p2"]);
  });

  it("removes a member via mutations", async () => {
    removeProjectMember.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useWorkspaceMembersSettings({
        workspaceId: "w1",
        workspace,
        projects,
        busy: false,
        setBusy: vi.fn(),
        setWorkspace: vi.fn(),
        onRoutesSuggested: vi.fn()
      })
    );
    act(() => {
      result.current.onRemoveMember("p1");
    });
    await vi.waitFor(() =>
      expect(removeProjectMember).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "p1" })
      )
    );
  });
});
