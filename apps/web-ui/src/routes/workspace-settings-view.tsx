import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Folder, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  addWorkspaceProject,
  deleteWorkspace,
  removeWorkspaceProject,
  updateWorkspace,
  updateWorkspaceProject,
  type WorkspaceMember,
  type WorkspaceRoute
} from "../lib/workspaces-api.js";
import {
  normalizeCatchAllLast,
  suggestPreviewRoutes
} from "../lib/suggest-preview-routes.js";
import { useWorkspace } from "../hooks/use-workspace.js";
import { cn } from "@/lib/utils";

type RouteRow = WorkspaceRoute & { key: string };

function sourceLabel(source: string): string {
  if (source === "github") return "GitHub";
  if (source === "local") return "Local";
  if (source === "upload") return "Upload";
  return source;
}

function newRouteKey(): string {
  return `route-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toRouteRows(routes: WorkspaceRoute[]): RouteRow[] {
  return routes.map((r) => ({ ...r, key: newRouteKey() }));
}

function fromRouteRows(rows: RouteRow[]): WorkspaceRoute[] {
  return rows.map(({ pathPrefix, target, stripPrefix }) => ({
    pathPrefix,
    target,
    ...(stripPrefix ? { stripPrefix: true } : {})
  }));
}

export function WorkspaceSettingsView() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const {
    workspace,
    projects,
    error,
    busy,
    setBusy,
    setError,
    setWorkspace
  } = useWorkspace(workspaceId);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [routeRows, setRouteRows] = useState<RouteRow[]>([]);
  const [routesDirty, setRoutesDirty] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [editingDepends, setEditingDepends] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace) return;
    if (!routesDirty) {
      setRouteRows(toRouteRows(workspace.routes ?? []));
    }
  }, [workspace, routesDirty]);

  const memberIds = useMemo(
    () => new Set(workspace?.members.map((m) => m.projectId) ?? []),
    [workspace]
  );

  const available = useMemo(
    () => projects.filter((p) => !memberIds.has(p.id)),
    [projects, memberIds]
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onAddSelected = () => {
    if (selectedIds.size === 0 || busy) return;
    void (async () => {
      setBusy(true);
      setMembersError(null);
      try {
        let latest = workspace;
        for (const projectId of selectedIds) {
          latest = await addWorkspaceProject(workspaceId, { projectId });
        }
        if (latest) {
          setWorkspace(latest);
          const savedRoutes = latest.routes ?? [];
          if (savedRoutes.length === 0 && latest.members.length > 0) {
            setRouteRows(
              toRouteRows(suggestPreviewRoutes(latest.members))
            );
            setRoutesDirty(true);
            setRoutesError(null);
          }
        }
        setSelectedIds(new Set());
      } catch (err) {
        setMembersError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  const onRemoveMember = (projectId: string) => {
    if (busy) return;
    void (async () => {
      setBusy(true);
      setMembersError(null);
      try {
        setWorkspace(await removeWorkspaceProject(workspaceId, projectId));
        setRoutesDirty(false);
      } catch (err) {
        setMembersError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  const onSaveDepends = (member: WorkspaceMember, dependsOn: string[]) => {
    if (busy) return;
    void (async () => {
      setBusy(true);
      setMembersError(null);
      try {
        setWorkspace(
          await updateWorkspaceProject(workspaceId, member.projectId, {
            dependsOn
          })
        );
        setEditingDepends(null);
      } catch (err) {
        setMembersError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  const onSaveRoutes = () => {
    if (busy) return;
    void (async () => {
      setBusy(true);
      setRoutesError(null);
      try {
        const normalized = normalizeCatchAllLast(fromRouteRows(routeRows));
        const updated = await updateWorkspace(workspaceId, {
          routes: normalized
        });
        setWorkspace(updated);
        setRouteRows(toRouteRows(updated.routes ?? []));
        setRoutesDirty(false);
      } catch (err) {
        setRoutesError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  const suggestedRoutes = useMemo(
    () =>
      workspace && workspace.members.length > 0
        ? suggestPreviewRoutes(workspace.members)
        : [],
    [workspace]
  );

  const applySuggestedRoutes = () => {
    if (suggestedRoutes.length === 0) return;
    setRouteRows(toRouteRows(suggestedRoutes));
    setRoutesDirty(true);
    setRoutesError(null);
  };

  const updateRow = (key: string, patch: Partial<WorkspaceRoute>) => {
    setRouteRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
    setRoutesDirty(true);
    setRoutesError(null);
  };

  const onDelete = () => {
    if (!workspace || busy) return;
    if (!confirm(`Delete workspace "${workspace.name}"?`)) return;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await deleteWorkspace(workspaceId);
        navigate("/");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    })();
  };

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

  const memberRepoNames = workspace.members.map((m) => m.repoName);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 p-6 pb-16">
      <header>
        <h2 className="text-2xl font-semibold">{workspace.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Projects forged into one session — shared chat, sandbox, and preview.
        </p>
      </header>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Projects in this workspace</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Member projects mount together when you open a workspace chat.
          </p>
        </div>

        {membersError && (
          <p className="text-sm text-destructive">{membersError}</p>
        )}

        {workspace.members.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            No projects yet. Pick from available projects below.
          </div>
        ) : (
          <ul className="space-y-2">
            {workspace.members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                allRepoNames={memberRepoNames}
                editing={editingDepends === m.projectId}
                busy={busy}
                onEdit={() =>
                  setEditingDepends(
                    editingDepends === m.projectId ? null : m.projectId
                  )
                }
                onSaveDepends={(deps) => onSaveDepends(m, deps)}
                onCancelEdit={() => setEditingDepends(null)}
                onRemove={() => onRemoveMember(m.projectId)}
              />
            ))}
          </ul>
        )}

        {available.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Add projects</p>
              <button
                type="button"
                disabled={busy || selectedIds.size === 0}
                onClick={onAddSelected}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Add selected
                {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {available.map((p) => {
                const selected = selectedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSelected(p.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl px-3 py-3 text-left shadow-sm transition-colors",
                      selected
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted/40 hover:bg-muted/70"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background"
                      )}
                    >
                      {selected ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">
                          {p.name}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {sourceLabel(p.source)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {available.length === 0 && workspace.members.length > 0 && (
          <p className="text-sm text-muted-foreground">
            All connected projects are already in this workspace.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Preview routing</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              When you open preview, which paths go to which project. Put
              specific paths (like /api) above the catch-all /.
            </p>
          </div>
          {workspace.members.length > 0 && suggestedRoutes.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={applySuggestedRoutes}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {routeRows.length === 0 ? "Use suggested" : "Reset to suggested"}
            </button>
          )}
        </div>

        {routesError && (
          <p className="text-sm text-destructive">{routesError}</p>
        )}

        {routeRows.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-dashed bg-muted/20 px-4 py-5">
            {suggestedRoutes.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                Add projects above to suggest preview routes.
              </p>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium">Suggested routes</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Based on your project names — edit after applying if needed.
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {suggestedRoutes.map((route) => (
                    <li
                      key={`${route.pathPrefix}->${route.target}`}
                      className="flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 font-mono text-sm shadow-sm"
                    >
                      <span className="text-muted-foreground">
                        {route.pathPrefix}
                      </span>
                      <span className="text-muted-foreground/60">→</span>
                      <span>{route.target}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy}
                  onClick={applySuggestedRoutes}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
                >
                  Use suggested routes
                </button>
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {routeRows.map((route) => (
              <li
                key={route.key}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 px-3 py-2"
              >
                <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
                  Path
                  <input
                    className="rounded-md bg-background px-2 py-1.5 font-mono text-sm text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
                    value={route.pathPrefix}
                    onChange={(e) =>
                      updateRow(route.key, { pathPrefix: e.target.value })
                    }
                    placeholder="/api"
                  />
                </label>
                <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
                  Project
                  <select
                    className="rounded-md bg-background px-2 py-1.5 text-sm text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
                    value={route.target}
                    onChange={(e) =>
                      updateRow(route.key, { target: e.target.value })
                    }
                  >
                    {memberRepoNames.length === 0 ? (
                      <option value={route.target}>{route.target}</option>
                    ) : (
                      memberRepoNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(route.stripPrefix)}
                    onChange={(e) =>
                      updateRow(route.key, {
                        stripPrefix: e.target.checked
                      })
                    }
                  />
                  Strip prefix
                </label>
                <button
                  type="button"
                  aria-label={`Remove route ${route.pathPrefix}`}
                  className="mt-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    setRouteRows((rows) =>
                      rows.filter((r) => r.key !== route.key)
                    );
                    setRoutesDirty(true);
                    setRoutesError(null);
                  }}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || workspace.members.length === 0}
            onClick={() => {
              const fallback = memberRepoNames[0] ?? "";
              setRouteRows((rows) => [
                ...rows,
                {
                  key: newRouteKey(),
                  pathPrefix: "/api",
                  target: fallback
                }
              ]);
              setRoutesDirty(true);
              setRoutesError(null);
            }}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Add route
          </button>
          <button
            type="button"
            disabled={busy || !routesDirty}
            onClick={onSaveRoutes}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            Save routes
          </button>
        </div>
      </section>

      <section className="border-t border-border/60 pt-8">
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
          Delete workspace
        </button>
      </section>
    </div>
  );
}

function MemberCard(options: {
  member: WorkspaceMember;
  allRepoNames: string[];
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onSaveDepends: (dependsOn: string[]) => void;
  onCancelEdit: () => void;
  onRemove: () => void;
}) {
  const {
    member,
    allRepoNames,
    editing,
    busy,
    onEdit,
    onSaveDepends,
    onCancelEdit,
    onRemove
  } = options;
  const others = allRepoNames.filter((n) => n !== member.repoName);
  const [draft, setDraft] = useState<Set<string>>(
    () => new Set(member.dependsOn)
  );

  useEffect(() => {
    if (editing) setDraft(new Set(member.dependsOn));
  }, [editing, member.dependsOn]);

  const toggleDep = (name: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <li className="rounded-xl bg-muted/40 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{member.project.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-background px-1.5 py-0.5 shadow-sm">
              {sourceLabel(member.project.source)}
            </span>
            <span className="font-mono">{member.repoName}</span>
            {!editing && member.dependsOn.length > 0 && (
              <span>
                depends on{" "}
                {member.dependsOn.map((d) => (
                  <span
                    key={d}
                    className="mr-1 inline-block rounded-md bg-background px-1.5 py-0.5 font-mono shadow-sm"
                  >
                    {d}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {others.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={onEdit}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {editing ? "Close" : "Depends on"}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            Remove
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
          <p className="text-xs text-muted-foreground">
            Start after these projects are ready:
          </p>
          {others.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Add another project to set dependencies.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {others.map((name) => {
                const on = draft.has(name);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDep(name)}
                    className={cn(
                      "rounded-md px-2 py-1 font-mono text-xs shadow-sm",
                      on
                        ? "bg-accent text-accent-foreground"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onSaveDepends([...draft])}
              className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground"
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancelEdit}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
