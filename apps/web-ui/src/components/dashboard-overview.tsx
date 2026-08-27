import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Flame,
  MessageSquare,
  FolderKanban
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  formatRelativeTime,
  heatmapLevel,
  type AttentionItem,
  type DashboardStats,
  type HeatmapCell
} from "../lib/dashboard-insights.js";

const HEATMAP_LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-muted/80",
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-4"
};

function StatCard(options: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {options.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {options.value}
          </p>
          {options.hint && (
            <p className="mt-1 text-xs text-muted-foreground">{options.hint}</p>
          )}
        </div>
        <div className="inline-flex size-9 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
          {options.icon}
        </div>
      </div>
    </div>
  );
}

function ActivityHeatmap(options: { weeks: HeatmapCell[][] }) {
  const { weeks } = options;
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 overflow-x-auto pb-1">
        {weeks.map((week, index) => (
          <div
            key={week[0]?.date ?? `week-${index}`}
            className="flex flex-col gap-1"
          >
            {week.map((cell) => {
              const level = heatmapLevel(cell.count);
              return (
                <div
                  key={cell.date}
                  title={
                    cell.count > 0
                      ? `${cell.count} session${cell.count === 1 ? "" : "s"} on ${cell.date}`
                      : `No activity on ${cell.date}`
                  }
                  className={`size-3 rounded-sm ${HEATMAP_LEVEL_CLASS[level]}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Last 20 weeks</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <div
              key={level}
              className={`size-3 rounded-sm ${HEATMAP_LEVEL_CLASS[level]}`}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

function AttentionList(options: { items: AttentionItem[] }) {
  if (options.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing needs attention right now. Keep building.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {options.items.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-3 rounded-lg border border-border bg-background/80 px-3 py-2.5"
        >
          <AlertCircle
            className={`mt-0.5 size-4 shrink-0 ${item.tone === "warning" ? "text-amber-500" : "text-primary"}`}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardOverview(options: {
  stats: DashboardStats;
  heatmap: HeatmapCell[][];
  attention: AttentionItem[];
  loading: boolean;
  projectCount: number;
  workspaceCount: number;
}) {
  const { stats, heatmap, attention, loading, projectCount, workspaceCount } =
    options;
  const lastActive =
    stats.lastActiveAt == null
      ? "No recent activity"
      : `Last active ${formatRelativeTime(stats.lastActiveAt)}`;

  return (
    <section className="mb-8 space-y-4">
      <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Your dashboard</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {loading ? "Loading activity…" : lastActive}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {projectCount} project{projectCount === 1 ? "" : "s"} ·{" "}
              {workspaceCount} workspace{workspaceCount === 1 ? "" : "s"}
            </p>
          </div>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            View settings
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Day streak"
            value={stats.streakDays}
            hint={stats.streakDays > 0 ? "Keep it going" : "Start today"}
            icon={<Flame className="size-4" />}
          />
          <StatCard
            label="Active chats"
            value={stats.totalChats}
            hint="Workbench sessions"
            icon={<MessageSquare className="size-4" />}
          />
          <StatCard
            label="Projects"
            value={stats.activeProjects}
            icon={<FolderKanban className="size-4" />}
          />
          <StatCard
            label="Contributions"
            value={stats.totalContributions}
            hint="Sessions in last 20 weeks"
            icon={<BarChart3 className="size-4" />}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Activity</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Session activity across your projects
          </p>
          <div className="mt-4">
            {loading ? (
              <div className="h-24 animate-pulse rounded-lg bg-muted/50" />
            ) : (
              <ActivityHeatmap weeks={heatmap} />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Needs attention</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Stale chats, unavailable projects, and setup gaps
          </p>
          <div className="mt-4">
            {loading ? (
              <div className="space-y-2">
                <div className="h-12 animate-pulse rounded-lg bg-muted/50" />
                <div className="h-12 animate-pulse rounded-lg bg-muted/50" />
              </div>
            ) : (
              <AttentionList items={attention} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
