import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useWorkspaceRoutesSettings } from "./use-workspace-routes-settings";
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
  routes: [{ pathPrefix: "/", target: "web" }],
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

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useWorkspaceRoutesSettings", () => {
  it("syncs route rows and applies suggested routes", async () => {
    const { result } = renderHook(
      () =>
        useWorkspaceRoutesSettings({
          workspaceId: "w1",
          workspace,
          busy: false,
          setBusy: vi.fn(),
          setError: vi.fn(),
          setWorkspace: vi.fn()
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.routeRows.length).toBe(1));
    expect(result.current.suggestedRoutes).toEqual([
      { pathPrefix: "/", target: "web" }
    ]);
    result.current.applySuggestedRoutes();
    await waitFor(() => expect(result.current.routesDirty).toBe(true));
  });

  it("saves routes through mutations", async () => {
    saveWorkspaceRoutes.mockResolvedValue({
      ...workspace,
      routes: [{ pathPrefix: "/api", target: "api" }]
    });
    const { result } = renderHook(
      () =>
        useWorkspaceRoutesSettings({
          workspaceId: "w1",
          workspace,
          busy: false,
          setBusy: vi.fn(),
          setError: vi.fn(),
          setWorkspace: vi.fn()
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.routeRows.length).toBe(1));
    result.current.onSaveRoutes();
    await waitFor(() => expect(saveWorkspaceRoutes).toHaveBeenCalled());
  });
});
