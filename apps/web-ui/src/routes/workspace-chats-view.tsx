import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, MessageSquarePlus } from "lucide-react";
import {
  createWorkspaceChat,
  getWorkspace,
  listWorkspaceChats,
  type WorkspaceDetail
} from "../lib/workspaces-api.js";

type ChatRow = { id: string; sessionId: string; title: string };

export function WorkspaceChatsView() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const onNewChat = () => {
    if (!hasMembers || busy) return;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const chat = await createWorkspaceChat(workspaceId);
        setChats(await listWorkspaceChats(workspaceId));
        navigate(`/workspaces/${workspaceId}/chats/${chat.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{workspace.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared chats across every project in this forge — one session,
            one sandbox, one preview.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewChat}
          disabled={busy || !hasMembers}
          title={
            hasMembers
              ? undefined
              : "Add projects in Settings first"
          }
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageSquarePlus className="size-4 text-primary" />
          )}
          New chat
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
      ) : chats.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm font-medium">No chats yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a workspace chat to work across all member projects.
          </p>
          <button
            type="button"
            onClick={onNewChat}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            <MessageSquarePlus className="size-4 text-primary" />
            New chat
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl bg-muted/20">
          {chats.map((c) => (
            <li key={c.id}>
              <Link
                to={`/workspaces/${workspaceId}/chats/${c.id}`}
                className="flex items-center px-4 py-3 text-sm transition-colors hover:bg-accent/40"
              >
                <span className="truncate font-medium">
                  {c.title || c.id}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
