import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDashboardInsights } from "./use-dashboard-insights";
import type { WorkspaceSummary } from "../lib/workspaces-api";

const fetchWorkbenchSessions = vi.fn();

vi.mock("../lib/projects-api.js", () => ({
  fetchWorkbenchSessions: (...args: unknown[]) =>
    fetchWorkbenchSessions(...args)
}));

const EMPTY_PROJECTS: Array<{
  id: string;
  name: string;
  status: "available" | "unavailable";
}> = [];
const EMPTY_WORKSPACES: WorkspaceSummary[] = [];

describe("useDashboardInsights", () => {
  beforeEach(() => {
    fetchWorkbenchSessions.mockReset();
  });

  it("returns empty sessions when there are no projects", async () => {
    const { result } = renderHook(() =>
      useDashboardInsights({
        projects: EMPTY_PROJECTS,
        workspaces: EMPTY_WORKSPACES
      })
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.sessions).toEqual([]);
    expect(result.current.stats.activeProjects).toBe(0);
    expect(result.current.heatmap).toHaveLength(20);
    expect(fetchWorkbenchSessions).not.toHaveBeenCalled();
  });

  it("loads sessions and builds stats from activity", async () => {
    const projects = [
      {
        id: "p1",
        name: "App",
        status: "available" as const,
        lastActivityAt: "2026-08-27T12:00:00.000Z"
      }
    ];
    const workspaces: WorkspaceSummary[] = [
      {
        id: "w1",
        userId: "u1",
        name: "Main",
        routes: [],
        createdAt: "2026-08-01T00:00:00.000Z",
        lastActivityAt: "2026-08-27T12:00:00.000Z"
      }
    ];
    fetchWorkbenchSessions.mockResolvedValueOnce([
      {
        id: "s1",
        title: "Chat",
        lastActivityAt: "2026-08-27T12:00:00.000Z"
      }
    ]);
    const { result } = renderHook(() =>
      useDashboardInsights({ projects, workspaces })
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.sessions).toHaveLength(1);
    });
    expect(result.current.sessions[0]).toEqual({
      id: "s1",
      projectId: "p1",
      projectName: "App",
      title: "Chat",
      lastActivityAt: "2026-08-27T12:00:00.000Z"
    });
    expect(result.current.stats.totalChats).toBe(1);
    expect(result.current.stats.activeProjects).toBe(1);
    expect(result.current.stats.totalContributions).toBeGreaterThan(0);
  });
});
