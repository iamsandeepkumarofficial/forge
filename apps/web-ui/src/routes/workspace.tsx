import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addWorkspaceProject,
  createWorkspaceChat,
  deleteWorkspace,
  getWorkspace,
  listWorkspaceChats,
  removeWorkspaceProject,
  updateWorkspace,
  updateWorkspaceProject,
  type WorkspaceDetail,
  type WorkspaceRoute
} from "../lib/workspaces-api.js";
import { runnerUrl } from "../lib/tool-runner.js";

type ProjectRow = { id: string; name: string; source: string };

export function WorkspacePage() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const [ws, setWs] = useState<WorkspaceDetail | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [chats, setChats] = useState<
    Array<{ id: string; sessionId: string; title: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addProjectId, setAddProjectId] = useState("");
  const [repoName, setRepoName] = useState("");
  const [routesText, setRoutesText] = useState("[]");

  const reload = async () => {
    const detail = await getWorkspace(workspaceId);
    setWs(detail);
    setRoutesText(JSON.stringify(detail.routes ?? [], null, 2));
    setChats(await listWorkspaceChats(workspaceId));
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const detail = await getWorkspace(workspaceId);
        if (cancelled) return;
        setWs(detail);
        setRoutesText(JSON.stringify(detail.routes ?? [], null, 2));
        setChats(await listWorkspaceChats(workspaceId));
        const res = await fetch(`${runnerUrl()}/api/projects`);
        if (res.ok) {
          const rows = (await res.json()) as ProjectRow[];
          if (!cancelled) setProjects(Array.isArray(rows) ? rows : []);
        }
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

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">{error}</p>
        <Link to="/" className="text-sm underline">
          Back
        </Link>
      </div>
    );
  }
  if (!ws) return <div className="p-8">Loading…</div>;

  const memberIds = new Set(ws.members.map((m) => m.projectId));
  const available = projects.filter((p) => !memberIds.has(p.id));

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/" className="text-sm text-muted-foreground hover:underline">
            ← Home
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{ws.name}</h1>
          <p className="text-sm text-muted-foreground">
            Multi-repo workspace — member projects mount together in one
            session.
          </p>
        </div>
        <button
          type="button"
          className="rounded px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          disabled={busy}
          onClick={() => {
            void (async () => {
              if (!confirm(`Delete workspace "${ws.name}"?`)) return;
              setBusy(true);
              try {
                await deleteWorkspace(workspaceId);
                navigate("/");
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Delete
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Members</h2>
        {ws.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects yet. Add connected projects below.
          </p>
        ) : (
          <ul className="space-y-2">
            {ws.members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"
              >
                <div>
                  <div className="font-medium">{m.repoName}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.project.name} · {m.project.source}
                    {m.dependsOn.length
                      ? ` · dependsOn: ${m.dependsOn.join(", ")}`
                      : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs"
                    disabled={busy}
                    onClick={() => {
                      const raw = prompt(
                        "dependsOn (comma-separated repoNames)",
                        m.dependsOn.join(", ")
                      );
                      if (raw == null) return;
                      const dependsOn = raw
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      void (async () => {
                        setBusy(true);
                        try {
                          setWs(
                            await updateWorkspaceProject(
                              workspaceId,
                              m.projectId,
                              { dependsOn }
                            )
                          );
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : String(err)
                          );
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  >
                    dependsOn
                  </button>
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs text-destructive"
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          setWs(
                            await removeWorkspaceProject(
                              workspaceId,
                              m.projectId
                            )
                          );
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : String(err)
                          );
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Add project
            <select
              className="mt-1 block rounded border bg-background px-2 py-1.5"
              value={addProjectId}
              onChange={(e) => setAddProjectId(e.target.value)}
            >
              <option value="">Select…</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            repoName (optional)
            <input
              className="mt-1 block rounded border bg-background px-2 py-1.5"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="frontend"
            />
          </label>
          <button
            type="button"
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            disabled={busy || !addProjectId}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  setWs(
                    await addWorkspaceProject(workspaceId, {
                      projectId: addProjectId,
                      repoName: repoName.trim() || undefined
                    })
                  );
                  setAddProjectId("");
                  setRepoName("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Add
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Gateway routes</h2>
        <p className="text-xs text-muted-foreground">
          Ordered path prefixes for the single-origin preview gateway. Put
          specific prefixes (e.g. /api) before catch-all /.
        </p>
        <textarea
          className="h-32 w-full rounded border bg-background p-2 font-mono text-xs"
          value={routesText}
          onChange={(e) => setRoutesText(e.target.value)}
        />
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm"
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true);
              try {
                const routes = JSON.parse(routesText) as WorkspaceRoute[];
                setWs(await updateWorkspace(workspaceId, { routes }));
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Save routes
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Chats</h2>
          <button
            type="button"
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            disabled={busy || ws.members.length === 0}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const chat = await createWorkspaceChat(workspaceId);
                  await reload();
                  navigate(`/workspaces/${workspaceId}/chats/${chat.id}`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            New workspace chat
          </button>
        </div>
        {chats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chats yet.</p>
        ) : (
          <ul className="space-y-1">
            {chats.map((c) => (
              <li key={c.id}>
                <Link
                  className="text-sm hover:underline"
                  to={`/workspaces/${workspaceId}/chats/${c.id}`}
                >
                  {c.title || c.id}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
