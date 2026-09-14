const MS_DAY = 86_400_000;
const N_DAYS_PER_WEEK = 7;

export type AttentionItem = {
  id: string;
  tone: "warning" | "info";
  title: string;
  detail: string;
};

export type HeatmapCell = {
  date: string;
  count: number;
};

export type DashboardStats = {
  totalChats: number;
  activeProjects: number;
  streakDays: number;
  totalContributions: number;
  lastActiveAt: number | null;
};

export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseTimestamp(
  value: number | string | undefined
): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildActivityCounts(
  timestamps: Array<number | null | undefined>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    if (ts == null || !Number.isFinite(ts)) continue;
    const key = dayKey(new Date(ts));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function computeStreak(
  counts: Map<string, number>,
  now = new Date()
): number {
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if ((counts.get(dayKey(cursor)) ?? 0) === 0) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while ((counts.get(dayKey(cursor)) ?? 0) > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function buildHeatmapWeeks(options: {
  counts: Map<string, number>;
  weeks: number;
  now?: Date;
}): HeatmapCell[][] {
  const now = options.now ?? new Date();
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - end.getDay());
  const start = new Date(end);
  start.setDate(start.getDate() - (options.weeks - 1) * N_DAYS_PER_WEEK);

  const grid: HeatmapCell[][] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: HeatmapCell[] = [];
    for (let i = 0; i < N_DAYS_PER_WEEK; i += 1) {
      const key = dayKey(cursor);
      week.push({ date: key, count: options.counts.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    grid.push(week);
  }
  return grid;
}

export function heatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

export function buildDashboardStats(options: {
  counts: Map<string, number>;
  projectCount: number;
  chatCount: number;
  timestamps: number[];
}): DashboardStats {
  const { counts, projectCount, chatCount, timestamps } = options;
  const totalContributions = [...counts.values()].reduce(
    (sum, n) => sum + n,
    0
  );
  const lastActiveAt = timestamps.length > 0 ? Math.max(...timestamps) : null;
  return {
    totalChats: chatCount,
    activeProjects: projectCount,
    streakDays: computeStreak(counts),
    totalContributions,
    lastActiveAt
  };
}

const STALE_DAYS = 14;

const MAX_RESUME_TIPS = 1;

export function buildAttentionItems(options: {
  projects: Array<{
    id: string;
    name: string;
    status: "available" | "unavailable";
  }>;
  workspaces: Array<{
    id: string;
    name: string;
    routes?: unknown[];
    lastActivityAt?: string;
  }>;
  sessions: Array<{
    id: string;
    projectId: string;
    projectName: string;
    title: string;
    lastActivityAt: string;
  }>;
  now?: number;
}): AttentionItem[] {
  const now = options.now ?? Date.now();
  const warnings: AttentionItem[] = [];
  const resumes: AttentionItem[] = [];
  const staleCutoff = now - STALE_DAYS * MS_DAY;

  for (const project of options.projects) {
    if (project.status === "unavailable") {
      warnings.push({
        id: `project-unavailable-${project.id}`,
        tone: "warning",
        title: `${project.name} is unavailable`,
        detail: "Reconnect or refresh the project to resume work."
      });
    }
  }

  for (const workspace of options.workspaces) {
    const routeCount = workspace.routes?.length ?? 0;
    if (routeCount === 0 && workspace.lastActivityAt) {
      warnings.push({
        id: `workspace-routes-${workspace.id}`,
        tone: "warning",
        title: `Configure routes for ${workspace.name}`,
        detail: "This workspace is active but has no gateway routes yet."
      });
    }
  }

  for (const session of options.sessions) {
    if (resumes.length >= MAX_RESUME_TIPS) break;
    const last = parseTimestamp(session.lastActivityAt);
    if (last != null && last < staleCutoff) {
      resumes.push({
        id: `session-stale-${session.id}`,
        tone: "info",
        title: `Resume "${session.title}"`,
        detail: `Last active in ${session.projectName} over ${STALE_DAYS} days ago.`
      });
    }
  }

  return [...warnings, ...resumes];
}

export function formatRelativeTime(
  timestamp: number,
  now = Date.now()
): string {
  const delta = now - timestamp;
  if (delta < MS_DAY) return "today";
  const days = Math.floor(delta / MS_DAY);
  if (days === 1) return "yesterday";
  if (days < N_DAYS_PER_WEEK) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString();
}
