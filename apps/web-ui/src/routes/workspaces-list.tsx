import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  type WorkspaceSummary
} from "../lib/workspaces-api.js";

function WorkspacesEmpty(options: { busy: boolean; onCreate: () => void }) {
  const { busy, onCreate } = options;
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <p className="font-medium">No workspaces yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a workspace, then add the projects (repos) it should include.
      </p>
      <button
        type="button"
        onClick={onCreate}
        disabled={busy}
        className="mt-4 rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        Create workspace
      </button>
    </div>
  );
}

function WorkspaceListCards(options: {
  workspaces: WorkspaceSummary[];
  onOpen: (id: string) => void;
  onDelete: (ws: WorkspaceSummary) => void;
}) {
  const { workspaces, onOpen, onDelete } = options;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {workspaces.map((ws) => (
        <button
          key={ws.id}
          type="button"
          onClick={() => onOpen(ws.id)}
          className="rounded-lg border p-4 text-left hover:bg-muted/40"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold">{ws.name}</h3>
            <span
              role="button"
              tabIndex={0}
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(ws);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.stopPropagation();
                onDelete(ws);
              }}
            >
              Delete
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Multi-repo ·{" "}
            {ws.routes?.length
              ? `${ws.routes.length} gateway route(s)`
              : "no routes yet"}
          </p>
        </button>
      ))}
    </div>
  );
}

function WorkspacesListHeader(options: {
  busy: boolean;
  onCreate: () => void;
}) {
  const { busy, onCreate } = options;
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← Home
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Workspaces</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Group connected projects so a feature can span frontend, backend, and
          other services in one chat.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        disabled={busy}
        className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
      >
        New workspace
      </button>
    </div>
  );
}

function useWorkspacesListData() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkspaces(await listWorkspaces());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listWorkspaces();
        if (!cancelled) setWorkspaces(rows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = () => {
    void (async () => {
      const name = window.prompt("Workspace name", "My workspace");
      if (!name?.trim()) return;
      setBusy(true);
      try {
        const ws = await createWorkspace(name.trim());
        void navigate(`/workspaces/${ws.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleDelete = (ws: WorkspaceSummary) => {
    if (!confirm(`Delete workspace "${ws.name}"?`)) return;
    void (async () => {
      try {
        await deleteWorkspace(ws.id);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  };

  return {
    navigate,
    workspaces,
    loading,
    error,
    busy,
    handleCreate,
    handleDelete
  };
}

export function WorkspacesListPage() {
  const {
    navigate,
    workspaces,
    loading,
    error,
    busy,
    handleCreate,
    handleDelete
  } = useWorkspacesListData();

  let body: React.ReactNode;
  if (loading) {
    body = <p className="text-sm text-muted-foreground">Loading…</p>;
  } else if (workspaces.length === 0) {
    body = <WorkspacesEmpty busy={busy} onCreate={handleCreate} />;
  } else {
    body = (
      <WorkspaceListCards
        workspaces={workspaces}
        onOpen={(id) => void navigate(`/workspaces/${id}`)}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <div className="min-h-screen p-8">
      <WorkspacesListHeader busy={busy} onCreate={handleCreate} />
      {error && (
        <p className="mb-4 rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {body}
    </div>
  );
}
