import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteWorkspaceById,
  saveWorkspaceRoutes
} from "./workspace-routes-actions";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";

const updateWorkspace = vi.fn();
const deleteWorkspace = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  updateWorkspace: (...args: unknown[]) => updateWorkspace(...args),
  deleteWorkspace: (...args: unknown[]) => deleteWorkspace(...args)
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

describe("workspace-routes-actions", () => {
  beforeEach(() => {
    updateWorkspace.mockReset();
    deleteWorkspace.mockReset();
  });

  it("saves normalized routes onto the workspace", async () => {
    const updated = {
      ...workspace,
      routes: [{ pathPrefix: "/api", target: "api" }]
    };
    updateWorkspace.mockResolvedValue(updated);
    const setWorkspace = vi.fn();
    const result = await saveWorkspaceRoutes({
      workspaceId: "w1",
      routeRows: [
        { key: "r1", pathPrefix: "/api", target: "api" },
        { key: "r2", pathPrefix: "/*", target: "web" }
      ],
      setWorkspace
    });
    expect(updateWorkspace).toHaveBeenCalledWith("w1", {
      routes: [
        { pathPrefix: "/api", target: "api" },
        { pathPrefix: "/*", target: "web" }
      ]
    });
    expect(setWorkspace).toHaveBeenCalledWith(updated);
    expect(result).toBe(updated);
  });

  it("deletes the workspace and navigates home", async () => {
    deleteWorkspace.mockResolvedValue(undefined);
    const navigate = vi.fn();
    await deleteWorkspaceById({
      workspaceId: "w1",
      workspace,
      navigate
    });
    expect(deleteWorkspace).toHaveBeenCalledWith("w1");
    expect(navigate).toHaveBeenCalledWith("/");
  });
});
