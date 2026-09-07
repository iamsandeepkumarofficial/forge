import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  chatHrefForSession,
  fetchRuntimeActivity,
  stopRuntimeApp,
  stopRuntimeSession,
  type RuntimeActivity,
  type RuntimeActivityApp,
  type RuntimeActivitySession
} from "../lib/runtime-activity-api.js";

const SESSION_ID_PREVIEW_LEN = 8;

export function ActivityDialog(options: { onClose: () => void }) {
  const { onClose } = options;
  const state = useActivityDialogState();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-border bg-background shadow-lg"
        role="dialog"
        aria-labelledby="activity-dialog-title"
      >
        <ActivityDialogHeader
          runtimeKind={state.data?.runtimeKind}
          onClose={onClose}
        />
        <div className="overflow-y-auto px-4 py-3">
          <ActivityDialogBody state={state} onClose={onClose} />
        </div>
        {state.error && (
          <p className="border-t px-4 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityDialogHeader(options: {
  runtimeKind?: string;
  onClose: () => void;
}) {
  const { runtimeKind, onClose } = options;
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div>
        <h2 id="activity-dialog-title" className="text-lg font-semibold">
          Activity
        </h2>
        {runtimeKind && (
          <p className="text-xs text-muted-foreground">
            Runtime: {runtimeKind}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Close
      </button>
    </div>
  );
}

function ActivityDialogBody(options: {
  state: ReturnType<typeof useActivityDialogState>;
  onClose: () => void;
}) {
  const { state, onClose } = options;
  const { data, error, busy, onStopSession, onStopApp } = state;
  if (!data && !error) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (data && data.sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active sessions, apps, or ports.
      </p>
    );
  }
  return (
    <>
      {data?.sessions.map((session) => (
        <ActivitySessionRow
          key={session.sessionId}
          session={session}
          apps={data.apps.filter((a) => a.sessionId === session.sessionId)}
          ports={
            data.ports.find((p) => p.sessionId === session.sessionId)?.ports ??
            []
          }
          busy={busy}
          onClose={onClose}
          onStopSession={onStopSession}
          onStopApp={onStopApp}
        />
      ))}
    </>
  );
}

function ActivitySessionRow(options: {
  session: RuntimeActivitySession;
  apps: RuntimeActivityApp[];
  ports: number[];
  busy: string | null;
  onClose: () => void;
  onStopSession: (sessionId: string) => void;
  onStopApp: (sessionId: string, name: string) => void;
}) {
  const { session, apps, ports, busy, onClose, onStopSession, onStopApp } =
    options;
  const href = chatHrefForSession(session);
  return (
    <div className="mb-4 border-b border-border pb-3 last:mb-0 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{session.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {session.status}
            {session.running ? " · running" : ""} ·{" "}
            {session.sessionId.slice(0, SESSION_ID_PREVIEW_LEN)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {href && (
            <Link
              to={href}
              onClick={onClose}
              className="text-xs text-primary hover:underline"
            >
              Open
            </Link>
          )}
          <button
            type="button"
            disabled={busy === `session:${session.sessionId}`}
            onClick={() => onStopSession(session.sessionId)}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            Stop
          </button>
        </div>
      </div>
      {ports.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Ports: {ports.join(", ")}
        </p>
      )}
      {apps.map((app) => (
        <ActivityAppRow
          key={`${app.sessionId}:${app.name}`}
          app={app}
          busy={busy}
          onStopApp={onStopApp}
        />
      ))}
    </div>
  );
}

function ActivityAppRow(options: {
  app: RuntimeActivityApp;
  busy: string | null;
  onStopApp: (sessionId: string, name: string) => void;
}) {
  const { app, busy, onStopApp } = options;
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{app.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {app.running ? "running" : "stopped"}
          {app.hostPort ? ` · 127.0.0.1:${app.hostPort}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {app.previewUrl && (
          <a
            href={app.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Preview
          </a>
        )}
        {app.running && (
          <button
            type="button"
            disabled={busy === `app:${app.sessionId}:${app.name}`}
            onClick={() => onStopApp(app.sessionId, app.name)}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}

function useActivityDialogState() {
  const [data, setData] = useState<RuntimeActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await fetchRuntimeActivity();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchRuntimeActivity()
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onStopSession = async (sessionId: string) => {
    setBusy(`session:${sessionId}`);
    try {
      await stopRuntimeSession(sessionId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const onStopApp = async (sessionId: string, name: string) => {
    setBusy(`app:${sessionId}:${name}`);
    try {
      await stopRuntimeApp({ sessionId, name });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return { data, error, busy, onStopSession, onStopApp };
}
