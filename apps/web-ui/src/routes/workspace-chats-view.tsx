import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  GitBranch,
  Loader2,
  MessageSquarePlus,
  MoreVertical,
  Search,
  Trash2
} from "lucide-react";
import {
  formatRelativeTime,
  parseTimestamp
} from "../lib/dashboard-insights.js";
import {
  createWorkspaceChat,
  deleteWorkspaceChat,
  getWorkspace,
  listWorkspaceChats,
  type WorkspaceChat,
  type WorkspaceDetail
} from "../lib/workspaces-api.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function sortByActivity(chats: WorkspaceChat[]): WorkspaceChat[] {
  return [...chats].sort((a, b) => {
    const aTs = parseTimestamp(a.lastActivityAt) ?? 0;
    const bTs = parseTimestamp(b.lastActivityAt) ?? 0;
    return bTs - aTs;
  });
}

function SessionMeta(options: {
  lastActivityAt?: string;
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

export function WorkspaceChatsView() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [chats, setChats] = useState<WorkspaceChat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [ws, chatRows] = await Promise.all([
          getWorkspace(workspaceId),
          listWorkspaceChats(workspaceId)
        ]);
        if (cancelled) return;
        setWorkspace(ws);
        setChats(chatRows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const sorted = useMemo(() => sortByActivity(chats), [chats]);
  const mostRecent = sorted[0] ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((chat) => {
      const title = chat.title?.toLowerCase() ?? "";
      const branch = chat.branchName?.toLowerCase() ?? "";
      return title.includes(q) || branch.includes(q);
    });
  }, [sorted, query]);

  if (error && !workspace) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const hasMembers = workspace.members.length > 0;

  const openChat = (chatId: string) => {
    void navigate(`/workspaces/${workspaceId}/chats/${chatId}`);
  };

  const onNewChat = () => {
    if (!hasMembers || busy) return;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const chat = await createWorkspaceChat(workspaceId);
        setChats(await listWorkspaceChats(workspaceId));
        openChat(chat.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  const onDelete = (chat: WorkspaceChat) => {
    if (deletingId) return;
    const label = chat.title || "this chat";
    if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
    void (async () => {
      setDeletingId(chat.id);
      setError(null);
      try {
        await deleteWorkspaceChat(workspaceId, chat.id);
        setChats((prev) => prev.filter((c) => c.id !== chat.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDeletingId(null);
      }
    })();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Workspace
          </p>
          <h2 className="mt-1 text-2xl font-semibold">{workspace.name}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Forge together across every linked project in one session — shared
            sandbox and preview, separate from single-project chats.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewChat}
          disabled={busy || !hasMembers}
          title={hasMembers ? undefined : "Add projects in Settings first"}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageSquarePlus className="size-4 text-primary" />
          )}
          New workspace chat
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!hasMembers ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm font-medium">No projects in this workspace yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add projects in Settings before starting a chat.
          </p>
          <Link
            to={`/workspaces/${workspaceId}/settings`}
            className="mt-4 inline-flex rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            Open Settings
          </Link>
        </div>
      ) : (
        <>
          {mostRecent && (
            <section className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Continue in this workspace
              </p>
              <button
                type="button"
                onClick={() => openChat(mostRecent.id)}
                className="mt-2 w-full rounded-lg bg-background px-4 py-3 text-left shadow-sm transition-colors hover:bg-accent/40"
              >
                <div className="truncate font-medium">
                  {mostRecent.title || "Chat"}
                </div>
                <SessionMeta
                  lastActivityAt={mostRecent.lastActivityAt}
                  branchName={mostRecent.branchName}
                  createdAt={mostRecent.createdAt}
                />
              </button>
            </section>
          )}

          {chats.length > 0 && (
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
          )}

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
                    : "Open a multi-repo session to work across every linked project."}
                </p>
              </div>
              {!query.trim() && (
                <button
                  type="button"
                  onClick={onNewChat}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
                >
                  <MessageSquarePlus className="size-4 text-primary" />
                  New workspace chat
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {filtered.map((chat) => (
                <li
                  key={chat.id}
                  className="group flex items-center gap-2 px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => openChat(chat.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate font-medium hover:underline">
                      {chat.title || "Chat"}
                    </div>
                    <SessionMeta
                      lastActivityAt={chat.lastActivityAt}
                      branchName={chat.branchName}
                      createdAt={chat.createdAt}
                    />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${chat.title || "chat"}`}
                      disabled={deletingId === chat.id}
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground",
                        "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100",
                        deletingId === chat.id && "opacity-100"
                      )}
                    >
                      {deletingId === chat.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MoreVertical className="size-4" />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={deletingId === chat.id}
                        onClick={() => onDelete(chat)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
