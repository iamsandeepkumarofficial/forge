import { X } from "lucide-react";
import type { WorkspaceRoute } from "../lib/workspaces-api.js";
import { type RouteRow } from "./workspace-settings-helpers.js";

function SuggestedRoutesPanel(options: {
  suggestedRoutes: WorkspaceRoute[];
  busy: boolean;
  onApply: () => void;
}) {
  const { suggestedRoutes, busy, onApply } = options;
  if (suggestedRoutes.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Add projects above to suggest network-plane routes.
      </p>
    );
  }
  return (
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
            <span className="text-muted-foreground">{route.pathPrefix}</span>
            <span className="text-muted-foreground/60">→</span>
            <span>{route.target}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={busy}
        onClick={onApply}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Use suggested routes
      </button>
    </>
  );
}

function RouteEditorRow(options: {
  route: RouteRow;
  memberRepoNames: string[];
  onUpdate: (key: string, patch: Partial<RouteRow>) => void;
  onRemove: (key: string) => void;
}) {
  const { route, memberRepoNames, onUpdate, onRemove } = options;
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
      <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
        Path
        <input
          className="rounded-md bg-background px-2 py-1.5 font-mono text-sm text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
          value={route.pathPrefix}
          onChange={(e) => onUpdate(route.key, { pathPrefix: e.target.value })}
          placeholder="/api"
        />
      </label>
      <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
        Project
        <select
          className="rounded-md bg-background px-2 py-1.5 text-sm text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
          value={route.target}
          onChange={(e) => onUpdate(route.key, { target: e.target.value })}
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
            onUpdate(route.key, { stripPrefix: e.target.checked })
          }
        />
        Strip prefix
      </label>
      <button
        type="button"
        aria-label={`Remove route ${route.pathPrefix}`}
        className="mt-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => onRemove(route.key)}
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

function RouteEditorPanel(options: {
  routeRows: RouteRow[];
  memberRepoNames: string[];
  routesDirty: boolean;
  membersEmpty: boolean;
  busy: boolean;
  onUpdate: (key: string, patch: Partial<RouteRow>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  onSave: () => void;
}) {
  const o = options;
  return (
    <>
      <ul className="space-y-2">
        {o.routeRows.map((route) => (
          <RouteEditorRow
            key={route.key}
            route={route}
            memberRepoNames={o.memberRepoNames}
            onUpdate={o.onUpdate}
            onRemove={o.onRemove}
          />
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={o.busy || o.membersEmpty}
          onClick={o.onAdd}
          className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          Add route
        </button>
        <button
          type="button"
          disabled={o.busy || !o.routesDirty}
          onClick={o.onSave}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          Save routes
        </button>
      </div>
    </>
  );
}

export function WorkspaceRoutesSection(options: {
  routeRows: RouteRow[];
  routesDirty: boolean;
  routesError: string | null;
  suggestedRoutes: WorkspaceRoute[];
  memberRepoNames: string[];
  membersEmpty: boolean;
  busy: boolean;
  onApplySuggested: () => void;
  onUpdateRow: (key: string, patch: Partial<RouteRow>) => void;
  onRemoveRow: (key: string) => void;
  onAddRoute: () => void;
  onSaveRoutes: () => void;
}) {
  const o = options;
  const showSuggestBtn = !o.membersEmpty && o.suggestedRoutes.length > 0;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Network plane</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            App preview routing on the network plane. Put specific paths (like
            /api) above the catch-all /. Databases live on docker network{" "}
            <span className="font-mono">forge</span> (see the Databases tab).
          </p>
        </div>
        {showSuggestBtn ? (
          <button
            type="button"
            disabled={o.busy}
            onClick={o.onApplySuggested}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {o.routeRows.length === 0 ? "Use suggested" : "Reset to suggested"}
          </button>
        ) : null}
      </div>
      {o.routesError ? (
        <p className="text-sm text-destructive">{o.routesError}</p>
      ) : null}
      {o.routeRows.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-dashed bg-muted/20 px-4 py-5">
          <SuggestedRoutesPanel
            suggestedRoutes={o.suggestedRoutes}
            busy={o.busy}
            onApply={o.onApplySuggested}
          />
        </div>
      ) : (
        <RouteEditorPanel
          routeRows={o.routeRows}
          memberRepoNames={o.memberRepoNames}
          routesDirty={o.routesDirty}
          membersEmpty={o.membersEmpty}
          busy={o.busy}
          onUpdate={o.onUpdateRow}
          onRemove={o.onRemoveRow}
          onAdd={o.onAddRoute}
          onSave={o.onSaveRoutes}
        />
      )}
    </section>
  );
}
