import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMemberMutations } from "./use-member-mutations";
import type {
  WorkspaceDetail,
  WorkspaceMember
} from "../lib/workspaces-api.js";

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
  members: []
};

const member: WorkspaceMember = {
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
};

describe("useMemberMutations", () => {
  beforeEach(() => {
    addSelectedProjects.mockReset();
    removeProjectMember.mockReset();
    saveMemberDepends.mockReset();
  });

  it("adds selected projects and clears selection", async () => {
    addSelectedProjects.mockResolvedValue({
      ...workspace,
      members: [member],
      routes: [{ pathPrefix: "/", target: "web" }]
    });
    const setBusy = vi.fn();
    const setWorkspace = vi.fn();
    const setMembersError = vi.fn();
    const setSelectedIds = vi.fn();
    const onRoutesSuggested = vi.fn();
    const { onAddSelected } = useMemberMutations({
      workspaceId: "w1",
      workspace,
      busy: false,
      selectedIds: new Set(["p1"]),
      setBusy,
      setWorkspace,
      setMembersError,
      setEditingDepends: vi.fn(),
      setSelectedIds,
      onRoutesSuggested
    });
    onAddSelected();
    await vi.waitFor(() =>
      expect(setSelectedIds).toHaveBeenCalledWith(new Set())
    );
    expect(onRoutesSuggested).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(setBusy.mock.calls.some((c) => c[0] === false)).toBe(true)
    );
  });

  it("suggests routes when added workspace has none", async () => {
    addSelectedProjects.mockResolvedValue({
      ...workspace,
      members: [member],
      routes: []
    });
    const onRoutesSuggested = vi.fn();
    const { onAddSelected } = useMemberMutations({
      workspaceId: "w1",
      workspace,
      busy: false,
      selectedIds: new Set(["p1"]),
      setBusy: vi.fn(),
      setWorkspace: vi.fn(),
      setMembersError: vi.fn(),
      setEditingDepends: vi.fn(),
      setSelectedIds: vi.fn(),
      onRoutesSuggested
    });
    onAddSelected();
    await vi.waitFor(() => expect(onRoutesSuggested).toHaveBeenCalled());
  });

  it("removes members and saves depends", async () => {
    removeProjectMember.mockResolvedValue(undefined);
    saveMemberDepends.mockResolvedValue(undefined);
    const setEditingDepends = vi.fn();
    const { onRemoveMember, onSaveDepends } = useMemberMutations({
      workspaceId: "w1",
      workspace,
      busy: false,
      selectedIds: new Set(),
      setBusy: vi.fn(),
      setWorkspace: vi.fn(),
      setMembersError: vi.fn(),
      setEditingDepends,
      setSelectedIds: vi.fn(),
      onRoutesSuggested: vi.fn()
    });
    onRemoveMember("p1");
    await vi.waitFor(() =>
      expect(removeProjectMember).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "p1" })
      )
    );
    onSaveDepends(member, ["p2"]);
    await vi.waitFor(() => {
      expect(saveMemberDepends).toHaveBeenCalled();
      expect(setEditingDepends).toHaveBeenCalledWith(null);
    });
  });
});
