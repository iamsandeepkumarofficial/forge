import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useApiExplorer } from "./use-api-explorer";

const fetchAppRoutes = vi.fn();
const requestSessionAppHttp = vi.fn();
const discoverOpenApi = vi.fn();

vi.mock("../../lib/session-http.js", () => ({
  fetchAppRoutes: (...args: unknown[]) => fetchAppRoutes(...args),
  requestSessionAppHttp: (...args: unknown[]) => requestSessionAppHttp(...args)
}));

vi.mock("./api-explorer-model.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./api-explorer-model.js")>();
  return {
    ...actual,
    discoverOpenApi: (...args: unknown[]) => discoverOpenApi(...args)
  };
});

const app = {
  name: "api",
  url: "http://localhost:4000/",
  running: true
} as never;

describe("useApiExplorer", () => {
  beforeEach(() => {
    fetchAppRoutes.mockReset();
    requestSessionAppHttp.mockReset();
    discoverOpenApi.mockReset();
    fetchAppRoutes.mockResolvedValue([]);
    discoverOpenApi.mockResolvedValue([]);
  });

  it("starts with GET / and clears ops when no app", async () => {
    const { result } = renderHook(() =>
      useApiExplorer({ sessionId: "s1", app: undefined })
    );
    expect(result.current.method).toBe("GET");
    expect(result.current.path).toBe("/");
    await waitFor(() => expect(result.current.scanning).toBe(false));
    expect(result.current.ops).toEqual([]);
  });

  it("pick applies method and path from an operation", async () => {
    const { result } = renderHook(() =>
      useApiExplorer({ sessionId: "s1", app })
    );
    await waitFor(() => expect(result.current.scanning).toBe(false));
    act(() => {
      result.current.pick({
        method: "POST",
        path: "/users"
      });
    });
    expect(result.current.method).toBe("POST");
    expect(result.current.path).toBe("/users");
  });

  it("send stores the formatted response", async () => {
    requestSessionAppHttp.mockResolvedValue({
      status: 200,
      statusText: "OK",
      durationMs: 12,
      body: '{"ok":true}'
    });
    const { result } = renderHook(() =>
      useApiExplorer({ sessionId: "s1", app })
    );
    await waitFor(() => expect(result.current.scanning).toBe(false));
    await act(async () => {
      await result.current.send();
    });
    expect(requestSessionAppHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "s1",
        appName: "api",
        method: "GET",
        path: "/"
      })
    );
    expect(result.current.result).toMatchObject({
      status: 200,
      statusText: "OK",
      durationMs: 12
    });
    expect(result.current.error).toBeNull();
  });
});
