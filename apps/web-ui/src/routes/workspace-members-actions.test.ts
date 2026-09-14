import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addSelectedProjects,
  removeProjectMember,
  saveMemberDepends
} from "./workspace-members-actions";
import type {
  WorkspaceDetail,
  WorkspaceMember
} from "../lib/workspaces-api.js";

const addWorkspaceProject = vi.fn();
const removeWorkspaceProject = vi.fn();
const updateWorkspaceProject = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  addWorkspaceProject: (...args: unknown[]) => addWorkspaceProject(...args),
  removeWorkspaceProject: (...args: unknown[]) =>
    removeWorkspaceProject(...args),
  updateWorkspaceProject: (...args: unknown[]) =>
    updateWorkspaceProject(...args)
}));

const workspace = (members: WorkspaceMember[] = []): WorkspaceDetail => ({
  id: "w1",
  userId: "u1",
  name: "Demo",
  routes: [],
  createdAt: "",
  lastActivityAt: "",
  members
});

const member = (projectId: string): WorkspaceMember => ({
  id: `m-${projectId}`,
  workspaceId: "w1",
  projectId,
  repoName: projectId,
  sortOrder: 0,
  dependsOn: [],
  env: {},
  createdAt: "",
  project: {
    id: projectId,
    name: projectId,
    source: "local",
    dedupeKey: projectId,
    status: "ready"
  }
});

describe("workspace-members-actions", () => {
  beforeEach(() => {
    addWorkspaceProject.mockReset();
    removeWorkspaceProject.mockReset();
    updateWorkspaceProject.mockReset();
  });

  it("adds each selected project and updates workspace", async () => {
    const latest = workspace([member("p1"), member("p2")]);
    addWorkspaceProject
      .mockResolvedValueOnce(workspace([member("p1")]))
      .mockResolvedValueOnce(latest);
    const setWorkspace = vi.fn();
    const result = await addSelectedProjects({
      workspaceId: "w1",
      workspace: workspace(),
      selectedIds: new Set(["p1", "p2"]),
      setWorkspace
    });
    expect(addWorkspaceProject).toHaveBeenCalledTimes(2);
    expect(setWorkspace).toHaveBeenCalledWith(latest);
    expect(result).toBe(latest);
  });

  it("removes a member and saves depends", async () => {
    const afterRemove = workspace();
    removeWorkspaceProject.mockResolvedValue(afterRemove);
    const setWorkspace = vi.fn();
    await removeProjectMember({
      workspaceId: "w1",
      projectId: "p1",
      setWorkspace
    });
    expect(removeWorkspaceProject).toHaveBeenCalledWith("w1", "p1");
    expect(setWorkspace).toHaveBeenCalledWith(afterRemove);

    const afterDepends = workspace([member("p1")]);
    updateWorkspaceProject.mockResolvedValue(afterDepends);
    await saveMemberDepends({
      workspaceId: "w1",
      member: member("p1"),
      dependsOn: ["p2"],
      setWorkspace
    });
    expect(updateWorkspaceProject).toHaveBeenCalledWith({
      workspaceId: "w1",
      projectId: "p1",
      patch: { dependsOn: ["p2"] }
    });
    expect(setWorkspace).toHaveBeenCalledWith(afterDepends);
  });
});
