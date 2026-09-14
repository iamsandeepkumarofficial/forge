import { useCallback, useEffect, useRef, useState } from "react";
import {
  listTerminalTabs,
  type TerminalTab
} from "../../lib/session-terminal.js";
import {
  listTrackedApps,
  listTrackedBackgroundJobs,
  subscribeTrackedTerminals,
  trackApp
} from "./tracked-terminals.js";
import {
  appNameFromTabId,
  applyTrackedRunningState,
  mergeApiTabsWithPinnedJobs
} from "./terminal-model.js";

export function useTerminalTabRefresh(sessionId: string) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef(sessionId);
  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);

  const syncTracked = useCallback(() => {
    setTabs((prev) =>
      applyTrackedRunningState(prev, {
        trackedApps: listTrackedApps(sessionId),
        trackedJobs: listTrackedBackgroundJobs(sessionId)
      })
    );
  }, [sessionId]);

  const refreshTabsStable = useCallback(async () => {
    const sid = sessionId;
    const apiTabs = await listTerminalTabs(sid);
    if (sessionRef.current !== sid) return apiTabs;
    for (const tab of apiTabs) {
      if (tab.kind === "app" && tab.running) {
        trackApp(sid, appNameFromTabId(tab.id));
      }
    }
    const jobRunning = Object.fromEntries(
      listTrackedBackgroundJobs(sid).map((name) => [name, true])
    );
    setTabs((prev) => {
      const merged = mergeApiTabsWithPinnedJobs({
        apiTabs,
        previous: prev,
        jobRunning
      });
      return applyTrackedRunningState(merged, {
        trackedApps: listTrackedApps(sid),
        trackedJobs: listTrackedBackgroundJobs(sid)
      });
    });
    return apiTabs;
  }, [sessionId]);

  useEffect(
    () => subscribeTrackedTerminals(() => syncTracked()),
    [syncTracked]
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setTabs([]);
      setLoading(true);
      void refreshTabsStable()
        .then(() => {
          if (!cancelled) setError(null);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, refreshTabsStable]);

  return { tabs, setTabs, loading, error, setError, refreshTabsStable };
}
