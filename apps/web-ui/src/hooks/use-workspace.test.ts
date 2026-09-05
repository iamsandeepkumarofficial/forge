import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useWorkspace } from "./use-workspace";

const getWorkspace = vi.fn();
const fetchProjects = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  getWorkspace: (...args: unknown[]) => getWorkspace(...args)
}));

vi.mock("../lib/projects-api.js", () => ({
  fetchProjects: (...args: unknown[]) => fetchProjects(...args)
}));

describe("useWorkspace", () => {
  beforeEach(() => {
    getWorkspace.mockReset();
    fetchProjects.mockReset();
  });

  it("loads workspace detail and projects", async () => {
    getWorkspace.mockResolvedValue({
      id: "w1",
      name: "Main",
      members: []
    });
    fetchProjects.mockResolvedValue([{ id: "p1", name: "App" }]);
    const { result } = renderHook(() => useWorkspace("w1"));
    await waitFor(() => {
      expect(result.current.workspace?.id).toBe("w1");
    });
    expect(result.current.projects).toEqual([{ id: "p1", name: "App" }]);
    expect(result.current.error).toBeNull();
  });

  it("surfaces load errors", async () => {
    getWorkspace.mockRejectedValue(new Error("missing"));
    const { result } = renderHook(() => useWorkspace("w1"));
    await waitFor(() => {
      expect(result.current.error).toBe("missing");
    });
    expect(result.current.workspace).toBeNull();
  });

  it("reloads workspace detail on demand", async () => {
    getWorkspace
      .mockResolvedValueOnce({ id: "w1", name: "Main", members: [] })
      .mockResolvedValueOnce({
        id: "w1",
        name: "Renamed",
        members: [{ id: "m1" }]
      });
    fetchProjects.mockResolvedValue([]);
    const { result } = renderHook(() => useWorkspace("w1"));
    await waitFor(() => {
      expect(result.current.workspace?.name).toBe("Main");
    });
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.workspace?.name).toBe("Renamed");
  });
});
