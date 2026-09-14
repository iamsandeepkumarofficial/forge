import { useCallback, useEffect, useState } from "react";
import { fetchApps, type AppStatus } from "../../lib/tool-runner.js";

const N_3000 = 3000;

type AppsState = {
  sessionId: string;
  exists: boolean;
  apps: AppStatus[];
  error: string | null;
};

function emptyFor(sessionId: string): AppsState {
  return { sessionId, exists: true, apps: [], error: null };
}

export function useApps(sessionId: string, intervalMs = N_3000) {
  const [state, setState] = useState(() => emptyFor(sessionId));
  if (state.sessionId !== sessionId) {
    setState(emptyFor(sessionId));
  }
  const refresh = useCallback(async () => {
    const sid = sessionId;
    try {
      const next = await fetchApps(sid);
      setState((prev) =>
        prev.sessionId !== sid
          ? prev
          : {
              sessionId: sid,
              exists: next.exists,
              apps: next.apps,
              error: null
            }
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setState((prev) =>
        prev.sessionId !== sid ? prev : { ...prev, error: message }
      );
    }
  }, [sessionId]);
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void refresh();
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refresh, intervalMs]);
  return {
    exists: state.exists,
    apps: state.apps,
    error: state.error,
    refresh
  };
}
