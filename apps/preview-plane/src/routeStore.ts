export type PathRouteRule = {
  pathPrefix: string;
  backendService: string;
  stripPrefix?: boolean;
};

export type PreviewRoute = {
  sessionId: string;
  port: number;
  hostname: string;
  backendService: string;
  ownerEmail?: string;
  pathRoutes?: PathRouteRule[];
};

export class RouteStore {
  private readonly byHostname = new Map<string, PreviewRoute>();

  upsert(route: PreviewRoute): PreviewRoute {
    this.byHostname.set(route.hostname.toLowerCase(), route);
    return route;
  }

  get(hostname: string): PreviewRoute | undefined {
    return this.byHostname.get(hostname.toLowerCase());
  }

  deleteSession(sessionId: string): number {
    let removed = 0;
    for (const [host, route] of this.byHostname) {
      if (route.sessionId === sessionId) {
        this.byHostname.delete(host);
        removed += 1;
      }
    }
    return removed;
  }

  deletePort(input: { sessionId: string; port: number }): boolean {
    for (const [host, route] of this.byHostname) {
      if (route.sessionId === input.sessionId && route.port === input.port) {
        this.byHostname.delete(host);
        return true;
      }
    }
    return false;
  }
}

export function matchPathRoute(
  pathRoutes: PathRouteRule[] | undefined,
  requestPath: string
): PathRouteRule | null {
  if (!pathRoutes?.length) return null;
  const path = requestPath.split("?")[0] || "/";
  let best: PathRouteRule | null = null;
  for (const rule of pathRoutes) {
    const prefix = rule.pathPrefix || "/";
    if (prefix === "/") {
      if (!best) best = rule;
      continue;
    }
    if (path === prefix || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`) || path.startsWith(prefix)) {
      if (!best || rule.pathPrefix.length > best.pathPrefix.length) {
        best = rule;
      }
    }
  }
  return best;
}

export const defaultRouteStore = new RouteStore();
