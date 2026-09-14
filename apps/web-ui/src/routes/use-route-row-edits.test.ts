import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRouteRowEdits, useRoutesDirtyState } from "./use-route-row-edits";
import type { RouteRow } from "./workspace-settings-helpers";

describe("useRouteRowEdits", () => {
  it("updates, removes, and adds route rows while marking dirty", () => {
    const markDirty = vi.fn();
    let rows: RouteRow[] = [{ key: "r1", pathPrefix: "/api", target: "api" }];
    const setRouteRows = vi.fn((fn: (r: RouteRow[]) => RouteRow[]) => {
      rows = fn(rows);
    });
    const { result } = renderHook(() =>
      useRouteRowEdits(markDirty, setRouteRows)
    );
    act(() => {
      result.current.updateRow("r1", { pathPrefix: "/v1" });
    });
    expect(rows[0]?.pathPrefix).toBe("/v1");
    act(() => {
      result.current.addRoute("web");
    });
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ pathPrefix: "/api", target: "web" });
    act(() => {
      result.current.removeRoute("r1");
    });
    expect(rows).toHaveLength(1);
    expect(markDirty).toHaveBeenCalledTimes(3);
  });
});

describe("useRoutesDirtyState", () => {
  it("marks routes dirty and clears errors", () => {
    const { result } = renderHook(() => useRoutesDirtyState());
    act(() => {
      result.current.setRoutesError("boom");
    });
    expect(result.current.routesError).toBe("boom");
    act(() => {
      result.current.markDirty();
    });
    expect(result.current.routesDirty).toBe(true);
    expect(result.current.routesError).toBeNull();
  });
});
