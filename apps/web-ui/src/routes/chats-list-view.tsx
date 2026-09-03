import { useMemo, useState } from "react";
import {
  GitBranch,
  Loader2,
  MessageSquarePlus,
  Search,
  Trash2
} from "lucide-react";
import {
  buildAttentionItems,
  formatRelativeTime,
  parseTimestamp
} from "../lib/dashboard-insights.js";
import type { ProjectWorkbenchSession } from "../lib/projects-api.js";
import type { ChatsPageState } from "./use-chats-page.js";
import { cn } from "@/lib/utils";

function sortByActivity(
  sessions: ProjectWorkbenchSession[]
): ProjectWorkbenchSession[] {
  return [...sessions].sort((a, b) => {
    const aTs = parseTimestamp(a.lastActivityAt) ?? 0;
    const bTs = parseTimestamp(b.lastActivityAt) ?? 0;
    return bTs - aTs;
  });
}

function SessionMeta(options: {
  lastActivityAt: string;
  branchName?: string;
  createdAt?: string;
}) {
  const { lastActivityAt, branchName, createdAt } = options;
  const lastTs = parseTimestamp(lastActivityAt);
  const createdTs = parseTimestamp(createdAt);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>
        Last active {lastTs != null ? formatRelativeTime(lastTs) : "—"}
      </span>
      {branchName ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
          <GitBranch className="size-3 shrink-0" />
          {branchName}
        </span>
      ) : null}
      {createdTs != null ? (
        <span className="text-muted-foreground/80">
          Created {formatRelativeTime(createdTs)}
        </span>
      ) : null}
    </div>
  );
}

export function ChatsListView({ state }: { state: ChatsPageState }) {
  const {
    projectId,
    project,
    sessions,
    error,
    deletingId,
    navigate,
    handleDelete
  } = state;
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => sortByActivity(sessions), [sessions]);
  const mostRecent = sorted[0] ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((session) => {
      const title = session.title?.toLowerCase() ?? "";
      const branch = session.branchName?.toLowerCase() ?? "";
      return title.includes(q) || branch.includes(q);
    });
  }, [sorted, query]);

  const attention = useMemo(() => {
    if (!projectId) return [];
    const projectName = project?.name ?? "Project";
    return buildAttentionItems({
      projects: project
        ? [
            {
              id: project.id,
              name: project.name,
              status: project.status
            }
          ]
        : [],
      workspaces: [],
      sessions: sessions.map((s) => ({
        id: s.id,
        projectId: s.projectId || projectId,
        projectName,
        title: s.title,
        lastActivityAt: s.lastActivityAt
      }))
    });
  }, [project, projectId, sessions]);

  const openSession = (sessionId: string) => {
    void navigate(`/projects/${projectId}/chats/${sessionId}`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Chats</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Workbench sessions for this project — each gets its own branch and
            sandbox.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            void navigate(`/projects/${projectId}/chats?new=1`)
          }
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          <MessageSquarePlus className="size-4 text-primary" />
          New chat
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {mostRecent && (
        <section className="rounded-xl bg-muted/40 p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Continue where you left off
          </p>
          <button
            type="button"
            onClick={() => openSession(mostRecent.id)}
            className="mt-2 w-full rounded-lg bg-background px-4 py-3 text-left shadow-sm transition-colors hover:bg-accent/40"
          >
            <div className="truncate font-medium">{mostRecent.title}</div>
            <SessionMeta
              lastActivityAt={mostRecent.lastActivityAt}
              branchName={mostRecent.branchName}
              createdAt={mostRecent.createdAt}
            />
          </button>
        </section>
      )}

      {attention.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Needs attention
          </p>
          <ul className="space-y-2">
            {attention.map((item) => {
              const sessionId = item.id.startsWith("session-stale-")
                ? item.id.replace("session-stale-", "")
                : null;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={!sessionId}
                    onClick={() => {
                      if (sessionId) openSession(sessionId);
                    }}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-left",
                      item.tone === "warning"
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border bg-muted/30",
                      sessionId && "hover:bg-muted/60"
                    )}
                  >
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {item.detail}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats or branches…"
          className="w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Search chats"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <MessageSquarePlus className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium">
              {query.trim() ? "No chats match your search" : "No chats yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {query.trim()
                ? "Try a different title or branch name."
                : "Start a workbench session to begin building."}
            </p>
          </div>
          {!query.trim() && (
            <button
              type="button"
              onClick={() =>
                void navigate(`/projects/${projectId}/chats?new=1`)
              }
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
            >
              <MessageSquarePlus className="size-4 text-primary" />
              New chat
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {filtered.map((session) => (
            <li key={session.id} className="flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => openSession(session.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate font-medium hover:underline">
                  {session.title}
                </div>
                <SessionMeta
                  lastActivityAt={session.lastActivityAt}
                  branchName={session.branchName}
                  createdAt={session.createdAt}
                />
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(session.id, session.title)}
                disabled={deletingId === session.id}
                className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                title="Delete chat"
              >
                {deletingId === session.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
