import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRouteRowSync } from "./use-route-row-sync";
import type { WorkspaceDetail } from "../lib/workspaces-api.js";

const workspace = (routes: WorkspaceDetail["routes"]): WorkspaceDetail => ({
  id: "w1",
  userId: "u1",
  name: "Demo",
  routes,
  createdAt: "",
  lastActivityAt: "",
  members: []
});

describe("useRouteRowSync", () => {
  it("syncs route rows from workspace when not dirty", () => {
    const setRouteRows = vi.fn();
    renderHook(() =>
      useRouteRowSync({
        workspace: workspace([{ pathPrefix: "/api", target: "api" }]),
        routesDirty: false,
        setRouteRows
      })
    );
    expect(setRouteRows).toHaveBeenCalledWith([
      expect.objectContaining({ pathPrefix: "/api", target: "api" })
    ]);
  });

  it("does not sync while routes are dirty", () => {
    const setRouteRows = vi.fn();
    renderHook(() =>
      useRouteRowSync({
        workspace: workspace([{ pathPrefix: "/api", target: "api" }]),
        routesDirty: true,
        setRouteRows
      })
    );
    expect(setRouteRows).not.toHaveBeenCalled();
  });
});
