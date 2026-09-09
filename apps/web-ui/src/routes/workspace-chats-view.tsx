import { Link, useParams } from "react-router-dom";
import {
  Loader2,
  MessageSquarePlus,
  MoreVertical,
  Search,
  Trash2,
  GitBranch
} from "lucide-react";
import {
  formatRelativeTime,
  parseTimestamp
} from "../lib/dashboard-insights.js";
import type { WorkspaceChat } from "../lib/workspaces-api.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useWorkspaceChatsPage } from "./use-workspace-chats-page.js";

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

function WorkspaceChatsHeader(options: {
  name: string;
  busy: boolean;
  hasMembers: boolean;
  executionTarget: "local" | "cloud";
  setExecutionTarget: (v: "local" | "cloud") => void;
  onNewChat: () => void;
}) {
  const {
    name,
    busy,
    hasMembers,
    executionTarget,
    setExecutionTarget,
    onNewChat
  } = options;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Workspace
        </p>
        <h2 className="mt-1 text-2xl font-semibold">{name}</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Forge together across every linked project in one session — shared
          sandbox and preview, separate from single-project chats.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Agent runtime"
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          value={executionTarget}
          onChange={(e) =>
            setExecutionTarget(e.target.value === "cloud" ? "cloud" : "local")
          }
        >
          <option value="local">Normal (local)</option>
          <option value="cloud">Cloud (Docker)</option>
        </select>
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
    </div>
  );
}

function WorkspaceChatRow(options: {
  chat: WorkspaceChat;
  deletingId: string | null;
  onOpen: (id: string) => void;
  onDelete: (chat: WorkspaceChat) => void;
}) {
  const { chat, deletingId, onOpen, onDelete } = options;
  return (
    <li className="group flex items-center gap-2 px-4 py-3">
      <button
        type="button"
        onClick={() => onOpen(chat.id)}
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
  );
}

function WorkspaceChatsEmpty(options: {
  query: string;
  busy: boolean;
  onNewChat: () => void;
}) {
  const { query, busy, onNewChat } = options;
  return (
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
  );
}

function ContinueWorkspaceChat(options: {
  chat: WorkspaceChat;
  onOpen: (id: string) => void;
}) {
  const { chat, onOpen } = options;
  return (
    <section className="rounded-xl bg-muted/40 p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Continue in this workspace
      </p>
      <button
        type="button"
        onClick={() => onOpen(chat.id)}
        className="mt-2 w-full rounded-lg bg-background px-4 py-3 text-left shadow-sm transition-colors hover:bg-accent/40"
      >
        <div className="truncate font-medium">{chat.title || "Chat"}</div>
        <SessionMeta
          lastActivityAt={chat.lastActivityAt}
          branchName={chat.branchName}
          createdAt={chat.createdAt}
        />
      </button>
    </section>
  );
}

function WorkspaceChatsBody(options: {
  chats: WorkspaceChat[];
  filtered: WorkspaceChat[];
  mostRecent: WorkspaceChat | null;
  query: string;
  onQuery: (v: string) => void;
  busy: boolean;
  deletingId: string | null;
  onOpen: (id: string) => void;
  onNewChat: () => void;
  onDelete: (chat: WorkspaceChat) => void;
}) {
  const {
    chats,
    filtered,
    mostRecent,
    query,
    onQuery,
    busy,
    deletingId,
    onOpen,
    onNewChat,
    onDelete
  } = options;
  return (
    <>
      {mostRecent && (
        <ContinueWorkspaceChat chat={mostRecent} onOpen={onOpen} />
      )}
      {chats.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search chats or branches…"
            className="w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Search chats"
          />
        </div>
      )}
      {filtered.length === 0 ? (
        <WorkspaceChatsEmpty query={query} busy={busy} onNewChat={onNewChat} />
      ) : (
        <ul className="divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {filtered.map((chat) => (
            <WorkspaceChatRow
              key={chat.id}
              chat={chat}
              deletingId={deletingId}
              onOpen={onOpen}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </>
  );
}

export function WorkspaceChatsView() {
  const { workspaceId = "" } = useParams();
  const page = useWorkspaceChatsPage(workspaceId);

  if (page.error && !page.workspace) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{page.error}</p>
      </div>
    );
  }
  if (!page.workspace) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-6">
      <WorkspaceChatsHeader
        name={page.workspace.name}
        busy={page.busy}
        hasMembers={page.hasMembers}
        executionTarget={page.executionTarget}
        setExecutionTarget={page.setExecutionTarget}
        onNewChat={page.onNewChat}
      />
      {page.error && <p className="text-sm text-destructive">{page.error}</p>}
      {!page.hasMembers ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm font-medium">
            No projects in this workspace yet
          </p>
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
        <WorkspaceChatsBody
          chats={page.chats}
          filtered={page.filtered}
          mostRecent={page.mostRecent}
          query={page.query}
          onQuery={page.setQuery}
          busy={page.busy}
          deletingId={page.deletingId}
          onOpen={page.openChat}
          onNewChat={page.onNewChat}
          onDelete={page.onDelete}
        />
      )}
    </div>
  );
}
