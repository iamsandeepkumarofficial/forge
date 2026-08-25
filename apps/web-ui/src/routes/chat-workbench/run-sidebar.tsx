import { useState } from "react";
import {
  scaffoldApps,
  runApp,
  stopApp,
  type AppStatus,
  type AppType
} from "../../lib/tool-runner.js";
import { useApps } from "./use-apps.js";
import { AddAppForm } from "./add-app-form.js";

export { AddAppForm } from "./add-app-form.js";

const N_3000 = 3000;

function typeBadge(type: AppType): string {
  return type === "web"
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    : type === "api"
      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
      : "bg-muted text-muted-foreground";
}

function MissingForgeBanner(options: {
  busy: string | null;
  onAutoCreate: () => void;
  onAddManual: () => void;
}) {
  const { busy, onAutoCreate, onAddManual } = options;
  return (
    <div className="m-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-800 dark:bg-amber-950/40">
      <p className="mb-2 font-medium text-amber-800 dark:text-amber-200">
        No .forge/launch.json in this repo.
      </p>
      <p className="mb-2 text-amber-700 dark:text-amber-300">
        Define which apps to run (like a launch.json). Auto-create from your
        workspace, or add apps manually.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onAutoCreate}
          disabled={busy === "__scaffold__"}
          className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50"
        >
          {busy === "__scaffold__" ? "Detecting…" : "Auto-create"}
        </button>
        <button onClick={onAddManual} className="rounded border px-2 py-1">
          Add manually
        </button>
      </div>
    </div>
  );
}

function AppRow(options: {
  app: AppStatus;
  busy: string | null;
  onRun: (name: string) => void;
  onStop: (name: string) => void;
  onShowPreview: () => void;
}) {
  const { app: a, busy, onRun, onStop, onShowPreview } = options;
  return (
    <li className="mb-1 rounded border px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${a.running ? "bg-green-500" : "bg-muted-foreground/40"}`}
        />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {a.name}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[0.55rem] uppercase ${typeBadge(a.type)}`}
        >
          {a.type}
        </span>
        {a.port != null && (
          <span className="text-[0.6rem] text-muted-foreground">:{a.port}</span>
        )}
        {a.running ? (
          <button
            onClick={() => onStop(a.name)}
            disabled={busy === a.name}
            className="rounded border px-2 py-0.5 text-[0.65rem]"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={() => onRun(a.name)}
            disabled={busy === a.name}
            className="rounded bg-primary px-2 py-0.5 text-[0.65rem] text-primary-foreground disabled:opacity-50"
          >
            Run
          </button>
        )}
      </div>
      {a.running && a.url && a.type === "web" && (
        <button
          onClick={onShowPreview}
          className="mt-1 truncate text-[0.65rem] text-primary hover:underline"
        >
          {a.url} → open preview
        </button>
      )}
      <div
        className="mt-0.5 truncate font-mono text-[0.6rem] text-muted-foreground"
        title={`${a.cwd} · ${a.command}`}
      >
        {a.cwd} · {a.command}
      </div>
    </li>
  );
}

export function RunSidebar({
  sessionId,
  onShowPreview
}: {
  sessionId: string;
  onShowPreview: () => void;
}) {
  const { exists, apps, error, refresh } = useApps(sessionId, N_3000);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const runNamed = async (options: {
    name: string;
    action: (sessionId: string, name: string) => Promise<unknown>;
  }) => {
    setBusy(options.name);
    try {
      await options.action(sessionId, options.name);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  const autoCreate = async () => {
    setBusy("__scaffold__");
    try {
      await scaffoldApps(sessionId);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <RunSidebarBody
      exists={exists}
      apps={apps}
      error={error}
      busy={busy}
      adding={adding}
      sessionId={sessionId}
      onShowPreview={onShowPreview}
      onAutoCreate={autoCreate}
      onToggleAdding={() => setAdding((v) => !v)}
      onSetAdding={setAdding}
      onRefresh={refresh}
      onRun={(name) => void runNamed({ name, action: runApp })}
      onStop={(name) => void runNamed({ name, action: stopApp })}
    />
  );
}

type SidebarBodyOptions = {
  exists: boolean;
  apps: AppStatus[];
  error: string | null;
  busy: string | null;
  adding: boolean;
  sessionId: string;
  onShowPreview: () => void;
  onAutoCreate: () => void;
  onToggleAdding: () => void;
  onSetAdding: (v: boolean) => void;
  onRefresh: () => Promise<void>;
  onRun: (name: string) => void;
  onStop: (name: string) => void;
};

function AppsList(options: {
  exists: boolean;
  apps: AppStatus[];
  busy: string | null;
  onRun: (name: string) => void;
  onStop: (name: string) => void;
  onShowPreview: () => void;
}) {
  const { exists, apps, busy, onRun, onStop, onShowPreview } = options;
  return (
    <ul className="px-2">
      {apps.map((a) => (
        <AppRow
          key={a.name}
          app={a}
          busy={busy}
          onRun={onRun}
          onStop={onStop}
          onShowPreview={onShowPreview}
        />
      ))}
      {apps.length === 0 && exists && (
        <li className="px-1 py-2 text-xs text-muted-foreground">
          No apps defined yet.
        </li>
      )}
    </ul>
  );
}

function RunSidebarBody(options: SidebarBodyOptions) {
  const {
    exists,
    apps,
    error,
    busy,
    adding,
    sessionId,
    onShowPreview,
    onAutoCreate,
    onToggleAdding,
    onSetAdding,
    onRefresh,
    onRun,
    onStop
  } = options;
  return (
    <div className="flex h-full flex-col overflow-auto">
      {!exists && (
        <MissingForgeBanner
          busy={busy}
          onAutoCreate={onAutoCreate}
          onAddManual={() => onSetAdding(true)}
        />
      )}
      {error && <p className="px-3 py-2 text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
          Apps
        </span>
        <button
          onClick={onToggleAdding}
          className="text-xs text-primary hover:underline"
        >
          {adding ? "Cancel" : "+ Add"}
        </button>
      </div>
      {adding && (
        <AddAppForm
          sessionId={sessionId}
          apps={apps}
          onDone={async () => {
            onSetAdding(false);
            await onRefresh();
          }}
        />
      )}
      <AppsList
        exists={exists}
        apps={apps}
        busy={busy}
        onRun={onRun}
        onStop={onStop}
        onShowPreview={onShowPreview}
      />
    </div>
  );
}
