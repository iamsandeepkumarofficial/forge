import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useApps } from "./use-apps";
import { fetchApps } from "../../lib/tool-runner.js";

vi.mock("../../lib/tool-runner.js", () => ({
  fetchApps: vi.fn()
}));

const fetchAppsMock = vi.mocked(fetchApps);

describe("useApps", () => {
  it("loads apps for a session", async () => {
    fetchAppsMock.mockResolvedValue({
      exists: true,
      apps: [
        { name: "web", type: "web", running: false, cwd: ".", command: "dev" }
      ]
    });
    const { result } = renderHook(() => useApps("s1"));
    await waitFor(() => {
      expect(result.current.apps).toHaveLength(1);
    });
    expect(result.current.apps[0]?.name).toBe("web");
  });

  it("clears apps immediately when sessionId changes", async () => {
    fetchAppsMock.mockImplementation(async (sessionId: string) => ({
      exists: true,
      apps: [
        {
          name: sessionId === "s1" ? "old-web" : "new-web",
          type: "web",
          running: true,
          cwd: ".",
          command: "dev",
          url: sessionId === "s1" ? "http://127.0.0.1:40001" : undefined
        }
      ]
    }));
    const { result, rerender } = renderHook(
      ({ sessionId }) => useApps(sessionId),
      { initialProps: { sessionId: "s1" } }
    );
    await waitFor(() => {
      expect(result.current.apps[0]?.name).toBe("old-web");
    });
    act(() => {
      rerender({ sessionId: "s2" });
    });
    expect(result.current.apps).toEqual([]);
    await waitFor(() => {
      expect(result.current.apps[0]?.name).toBe("new-web");
    });
  });
});
