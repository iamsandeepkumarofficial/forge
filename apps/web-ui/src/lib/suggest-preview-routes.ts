import type { WorkspaceMember, WorkspaceRoute } from "./workspaces-api.js";

const API_RE =
  /(^|[-_/])(api|backend|server|svc|service|bff)([-_/]|$)/i;
const FRONTEND_RE =
  /(^|[-_/])(frontend|front-end|web|ui|app|client|www)([-_/]|$)/i;

function haystack(m: WorkspaceMember): string {
  return `${m.repoName} ${m.project.name}`;
}

function isApiLike(m: WorkspaceMember): boolean {
  return API_RE.test(haystack(m));
}

function isFrontendLike(m: WorkspaceMember): boolean {
  return FRONTEND_RE.test(haystack(m));
}

/** Move catch-all `/` to the end so specific prefixes are not shadowed. */
export function normalizeCatchAllLast(
  routes: WorkspaceRoute[]
): WorkspaceRoute[] {
  const catchAlls = routes.filter((r) => r.pathPrefix.trim() === "/");
  const rest = routes.filter((r) => r.pathPrefix.trim() !== "/");
  if (catchAlls.length === 0) return routes;
  return [...rest, catchAlls[catchAlls.length - 1]!];
}

/**
 * Suggest preview routes from member names (e.g. bp-backend → /api,
 * bp-frontend → /). Catch-all `/` is always last.
 */
export function suggestPreviewRoutes(
  members: WorkspaceMember[]
): WorkspaceRoute[] {
  if (members.length === 0) return [];
  if (members.length === 1) {
    return [{ pathPrefix: "/", target: members[0]!.repoName }];
  }

  const api = members.find(isApiLike);
  const frontend = members.find(isFrontendLike);
  const used = new Set<string>();
  const routes: WorkspaceRoute[] = [];

  if (api) {
    routes.push({ pathPrefix: "/api", target: api.repoName });
    used.add(api.repoName);
  }

  const catchAll =
    frontend && !used.has(frontend.repoName)
      ? frontend
      : members.find((m) => !used.has(m.repoName)) ?? members[0]!;

  routes.push({ pathPrefix: "/", target: catchAll.repoName });
  return normalizeCatchAllLast(routes);
}
