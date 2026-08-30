import { runnerUrl } from "./tool-runner.js";

export type DiscoveredRoute = {
  method: string;
  path: string;
  summary?: string;
};

export type SessionHttpResponse = {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
};

export async function requestSessionAppHttp(options: {
  sessionId: string;
  appName: string;
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}): Promise<SessionHttpResponse> {
  const { sessionId, appName, method, path, headers, body, signal } = options;
  const res = await fetch(`${runnerUrl()}/internal/apps/http`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      appName,
      method,
      path,
      headers,
      body
    }),
    signal
  });
  const data = (await res.json()) as SessionHttpResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || String(res.status));
  }
  return {
    url: typeof data.url === "string" ? data.url : "",
    status: Number(data.status) || 0,
    statusText: typeof data.statusText === "string" ? data.statusText : "",
    headers:
      data.headers && typeof data.headers === "object" ? data.headers : {},
    body: typeof data.body === "string" ? data.body : "",
    durationMs: Number(data.durationMs) || 0
  };
}

export async function fetchAppRoutes(options: {
  sessionId: string;
  appName: string;
  signal?: AbortSignal;
}): Promise<DiscoveredRoute[]> {
  const { sessionId, appName, signal } = options;
  const u = new URL(`${runnerUrl()}/internal/apps/routes`);
  u.searchParams.set("sessionId", sessionId);
  u.searchParams.set("appName", appName);
  const res = await fetch(u.toString(), { signal });
  const data = (await res.json()) as { routes?: DiscoveredRoute[]; error?: string };
  if (!res.ok) {
    throw new Error(data.error || String(res.status));
  }
  return Array.isArray(data.routes) ? data.routes : [];
}
