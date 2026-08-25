export type PreviewRoute = {
  sessionId: string;
  port: number;
  hostname: string;
  backendService: string;
  ownerEmail?: string;
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

export const defaultRouteStore = new RouteStore();
