import { useState, type FormEvent } from "react";
import { Layers, Loader2 } from "lucide-react";
import {
  createWorkspace,
  type WorkspaceDetail
} from "../lib/workspaces-api.js";

export function CreateWorkspaceDialog(options: {
  onClose: () => void;
  onCreated: (workspace: WorkspaceDetail) => void;
}) {
  const { onClose, onCreated } = options;
  const [name, setName] = useState("My workspace");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a workspace name.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ws = await createWorkspace(trimmed);
      onCreated(ws);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Layers className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Create a workspace</h2>
            <p className="text-xs text-muted-foreground">
              Group services for one feature chat
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium">
            Workspace name
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="My workspace"
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
