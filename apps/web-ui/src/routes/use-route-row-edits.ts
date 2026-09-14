import { useState } from "react";
import { newRouteKey, type RouteRow } from "./workspace-settings-helpers.js";

export function useRouteRowEdits(
  markDirty: () => void,
  setRouteRows: (fn: (rows: RouteRow[]) => RouteRow[]) => void
) {
  const updateRow = (
    key: string,
    patch: Partial<{
      pathPrefix: string;
      target: string;
      stripPrefix?: boolean;
    }>
  ) => {
    setRouteRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
    markDirty();
  };
  const removeRoute = (key: string) => {
    setRouteRows((rows) => rows.filter((r) => r.key !== key));
    markDirty();
  };
  const addRoute = (fallbackTarget: string) => {
    setRouteRows((rows) => [
      ...rows,
      { key: newRouteKey(), pathPrefix: "/api", target: fallbackTarget }
    ]);
    markDirty();
  };
  return { updateRow, removeRoute, addRoute };
}

export function useRoutesDirtyState() {
  const [routesDirty, setRoutesDirty] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const markDirty = () => {
    setRoutesDirty(true);
    setRoutesError(null);
  };
  return {
    routesDirty,
    setRoutesDirty,
    routesError,
    setRoutesError,
    markDirty
  };
}
