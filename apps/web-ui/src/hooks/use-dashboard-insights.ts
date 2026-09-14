import { useEffect, useMemo, useState } from "react";
import { fetchWorkbenchSessions } from "../lib/projects-api.js";
import type { WorkspaceSummary } from "../lib/workspaces-api.js";
import {
  buildActivityCounts,
  buildAttentionItems,
  buildDashboardStats,
  buildHeatmapWeeks,
  parseTimestamp,
  type AttentionItem,
  type DashboardStats,
  type HeatmapCell
} from "../lib/dashboard-insights.js";

type ProjectRow = {
  id: string;
  name: string;
  status: "available" | "unavailable";
  lastActivityAt?: number | string;
};

export type DashboardSession = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  lastActivityAt: string;
};

export type DashboardInsights = {
  loading: boolean;
  stats: DashboardStats;
  heatmap: HeatmapCell[][];
  attention: AttentionItem[];
  sessions: DashboardSession[];
};

const N_HEATMAP_WEEKS = 20;

async function loadSessionsForProject(
  project: ProjectRow
): Promise<DashboardSession[]> {
  try {
    const list = await fetchWorkbenchSessions(project.id);
    return list.map((session) => ({
      id: session.id,
      projectId: project.id,
      projectName: project.name,
      title: session.title,
      lastActivityAt: session.lastActivityAt
    }));
  } catch {
    return [];
  }
}

export function useDashboardInsights(options: {
  projects: ProjectRow[];
  workspaces: WorkspaceSummary[];
}): DashboardInsights {
  const { projects, workspaces } = options;
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (projects.length === 0) {
        if (!cancelled) {
          setSessions((prev) => (prev.length === 0 ? prev : []));
          setLoading(false);
        }
        return;
      }
      if (!cancelled) setLoading(true);
      const rows = await Promise.all(
        projects.map((project) => loadSessionsForProject(project))
      );
      if (!cancelled) {
        setSessions(rows.flat());
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  return useMemo(() => {
    const timestamps = [
      ...sessions.map((s) => parseTimestamp(s.lastActivityAt)),
      ...projects.map((p) => parseTimestamp(p.lastActivityAt)),
      ...workspaces.map((w) => parseTimestamp(w.lastActivityAt))
    ].filter((ts): ts is number => ts != null);

    const counts = buildActivityCounts(timestamps);
    const stats = buildDashboardStats({
      counts,
      projectCount: projects.length,
      chatCount: sessions.length,
      timestamps
    });
    const heatmap = buildHeatmapWeeks({
      counts,
      weeks: N_HEATMAP_WEEKS
    });
    const attention = buildAttentionItems({
      projects,
      workspaces: workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        routes: ws.routes,
        lastActivityAt: ws.lastActivityAt
      })),
      sessions
    });

    return {
      loading,
      stats,
      heatmap,
      attention,
      sessions
    };
  }, [loading, projects, sessions, workspaces]);
}
