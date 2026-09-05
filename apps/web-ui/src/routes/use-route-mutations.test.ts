import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRouteMutations } from "./use-route-mutations";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";

const saveWorkspaceRoutes = vi.fn();
const deleteWorkspaceById = vi.fn();

vi.mock("./workspace-routes-actions.js", () => ({
  saveWorkspaceRoutes: (...args: unknown[]) => saveWorkspaceRoutes(...args),
  deleteWorkspaceById: (...args: unknown[]) => deleteWorkspaceById(...args)
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

describe("useRouteMutations", () => {
  beforeEach(() => {
    saveWorkspaceRoutes.mockReset();
    deleteWorkspaceById.mockReset();
  });

  it("saves routes and clears dirty state", async () => {
    saveWorkspaceRoutes.mockResolvedValue({
      ...workspace,
      routes: [{ pathPrefix: "/api", target: "api" }]
    });
    const setBusy = vi.fn();
    const setRouteRows = vi.fn();
    const setRoutesDirty = vi.fn();
    const setRoutesError = vi.fn();
    const { onSaveRoutes } = useRouteMutations({
      workspaceId: "w1",
      workspace,
      routeRows: [{ key: "r1", pathPrefix: "/api", target: "api" }],
      busy: false,
      setBusy,
      setError: vi.fn(),
      setWorkspace: vi.fn(),
      setRouteRows,
      setRoutesDirty,
      setRoutesError,
      navigate: vi.fn()
    });
    onSaveRoutes();
    await vi.waitFor(() => expect(saveWorkspaceRoutes).toHaveBeenCalled());
    expect(setRoutesDirty).toHaveBeenCalledWith(false);
    expect(setRouteRows).toHaveBeenCalledWith([
      expect.objectContaining({ pathPrefix: "/api", target: "api" })
    ]);
    expect(setBusy).toHaveBeenLastCalledWith(false);
  });

  it("deletes workspace after confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteWorkspaceById.mockResolvedValue(undefined);
    const navigate = vi.fn();
    const { onDelete } = useRouteMutations({
      workspaceId: "w1",
      workspace,
      routeRows: [],
      busy: false,
      setBusy: vi.fn(),
      setError: vi.fn(),
      setWorkspace: vi.fn(),
      setRouteRows: vi.fn(),
      setRoutesDirty: vi.fn(),
      setRoutesError: vi.fn(),
      navigate
    });
    onDelete();
    await vi.waitFor(() =>
      expect(deleteWorkspaceById).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "w1", navigate })
      )
    );
    confirmSpy.mockRestore();
  });
});
