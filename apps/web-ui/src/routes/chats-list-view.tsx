import { Loader2, Trash2 } from "lucide-react";
import { formatActivity } from "./chats-storage.js";
import type { ChatsPageState } from "./use-chats-page.js";

export function ChatsListView({ state }: { state: ChatsPageState }) {
  const { projectId, sessions, error, deletingId, navigate, handleDelete } =
    state;
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <div>
        <h2 className="text-2xl font-semibold">Chats</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manual workbench sessions. Use{" "}
          <span className="font-medium">New chat</span> in the sidebar to start
          another.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="divide-y divide-border overflow-y-auto rounded-xl border border-border">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() =>
                void navigate(`/projects/${projectId}/chats/${session.id}`)
              }
              className="min-w-0 flex-1 text-left hover:underline"
            >
              <div className="truncate font-medium">{session.title}</div>
              <div className="text-xs text-muted-foreground">
                Last active {formatActivity(session.lastActivityAt)}
              </div>
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
    </div>
  );
}
