import type { WorkspaceRoute } from "../lib/workspaces-api.js";

export type RouteRow = WorkspaceRoute & { key: string };
export type SettingsTab =
  "overview" | "parameters" | "databases" | "environment";

const ROUTE_KEY_RADIX = 36;
const ROUTE_KEY_SLICE_START = 2;
const ROUTE_KEY_SLICE_END = 9;

export function sourceLabel(source: string): string {
  if (source === "github") return "GitHub";
  if (source === "local") return "Local";
  if (source === "upload") return "Upload";
  return source;
}

export function newRouteKey(): string {
  return `route-${Date.now()}-${Math.random().toString(ROUTE_KEY_RADIX).slice(ROUTE_KEY_SLICE_START, ROUTE_KEY_SLICE_END)}`;
}

export function toRouteRows(routes: WorkspaceRoute[]): RouteRow[] {
  return routes.map((r) => ({ ...r, key: newRouteKey() }));
}

export function fromRouteRows(rows: RouteRow[]): WorkspaceRoute[] {
  return rows.map(({ pathPrefix, target, stripPrefix }) => ({
    pathPrefix,
    target,
    ...(stripPrefix ? { stripPrefix: true } : {})
  }));
}
