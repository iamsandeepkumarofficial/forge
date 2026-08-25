import { useState, useEffect, useCallback } from "react";
import { fetchApps, type AppStatus } from "../../lib/tool-runner.js";

const N_3000 = 3000;

export function useApps(sessionId: string, intervalMs = N_3000) {
  const [state, setState] = useState<{
    exists: boolean;
    apps: AppStatus[];
  }>({ exists: true, apps: [] });
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      setState(await fetchApps(sessionId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
  return { ...state, error, refresh };
}
