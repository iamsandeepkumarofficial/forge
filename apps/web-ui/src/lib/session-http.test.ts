import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAppRoutes, requestSessionAppHttp } from "./session-http";

describe("session-http", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("posts a request through the session proxy", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        url: "http://127.0.0.1:13000/health",
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        body: '{"ok":true}',
        durationMs: 12
      })
    } as Response);
    const result = await requestSessionAppHttp({
      sessionId: "s1",
      appName: "api",
      method: "GET",
      path: "/health"
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/internal/apps/http",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"ok":true}');
  });

  it("fetches discovered app routes", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{ method: "GET", path: "/health" }]
      })
    } as Response);
    const routes = await fetchAppRoutes({ sessionId: "s1", appName: "api" });
    expect(routes[0]?.path).toBe("/health");
  });
});
