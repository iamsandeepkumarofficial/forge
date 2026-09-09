import { Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import type { ProjectWorkbenchSession } from "../lib/projects-api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatActivity(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function WorkbenchCreateForm(options: {
  title: string;
  executionTarget: "local" | "cloud";
  creating: boolean;
  onTitleChange: (value: string) => void;
  onExecutionTargetChange: (value: "local" | "cloud") => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    title,
    executionTarget,
    creating,
    onTitleChange,
    onExecutionTargetChange,
    onSubmit
  } = options;
  return (
    <form onSubmit={onSubmit} className="space-y-3 border-b px-4 py-3">
      <div className="space-y-1.5">
        <Label htmlFor="workbench-title">New manual chat</Label>
        <Input
          id="workbench-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Session title"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="workbench-execution-target">Agent runtime</Label>
        <select
          id="workbench-execution-target"
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          value={executionTarget}
          onChange={(e) =>
            onExecutionTargetChange(
              e.target.value === "cloud" ? "cloud" : "local"
            )
          }
        >
          <option value="local">Normal (local host)</option>
          <option value="cloud">Cloud (Docker)</option>
        </select>
      </div>
      <Button type="submit" disabled={creating} className="w-full">
        {creating ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Creating…
          </>
        ) : (
          <>
            <MessageSquarePlus className="mr-2 size-4" />
            Start workbench session
          </>
        )}
      </Button>
    </form>
  );
}

export function WorkbenchSessionList(options: {
  loading: boolean;
  sessions: ProjectWorkbenchSession[];
  deletingId: string | null;
  onResume: (sessionId: string) => void;
  onDelete: (sessionId: string, title: string) => void;
}) {
  const { loading, sessions, deletingId, onResume, onDelete } = options;
  return (
    <div className="max-h-80 overflow-y-auto px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Recent sessions
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No workbench sessions yet. Create one to chat in its own branch and
          sandbox.
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center gap-2 rounded border border-border px-3 py-2"
            >
              <button
                type="button"
                onClick={() => onResume(session.id)}
                className="min-w-0 flex-1 text-left hover:underline"
              >
                <div className="truncate font-medium">{session.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  Last active {formatActivity(session.lastActivityAt)}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDelete(session.id, session.title)}
                disabled={deletingId === session.id}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                title="Delete session"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
