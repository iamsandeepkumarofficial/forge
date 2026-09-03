import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiExplorer } from "./api-explorer";
import { fetchAppRoutes, requestSessionAppHttp } from "../../lib/session-http.js";

vi.mock("../../lib/session-http.js", () => ({
  requestSessionAppHttp: vi.fn(),
  fetchAppRoutes: vi.fn(async () => [
    { method: "GET", path: "/health", summary: "Liveness" }
  ])
}));

describe("ApiExplorer", () => {
  it("lists existing routes and sends a request", async () => {
    vi.mocked(requestSessionAppHttp).mockImplementation(
      async (opts: { path: string }) => {
        if (opts.path !== "/health") {
          return {
            status: 404,
            statusText: "Not Found",
            headers: {},
            body: "",
            durationMs: 1,
            url: ""
          };
        }
        return {
          url: "http://127.0.0.1:13000/health",
          status: 200,
          statusText: "OK",
          headers: {},
          body: '{"ok":true}',
          durationMs: 9
        };
      }
    );
    render(
      <ApiExplorer
        sessionId="s1"
        app={{
          name: "api",
          type: "api",
          cwd: ".",
          command: "dev",
          port: 3000,
          running: true,
          hostPort: 13000,
          url: "http://p3000.preview.localhost/"
        }}
      />
    );
    await waitFor(() => {
      expect(fetchAppRoutes).toHaveBeenCalled();
      expect(screen.getByText("/health")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("/health"));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(screen.getByText(/200 OK/)).toBeTruthy();
    });
    expect(screen.getByText(/"ok": true/)).toBeTruthy();
  });
});
