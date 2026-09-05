import { useCallback, useEffect, useState } from "react";
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

  const syncTracked = useCallback(() => {
    setTabs((prev) =>
      applyTrackedRunningState(prev, {
        trackedApps: listTrackedApps(sessionId),
        trackedJobs: listTrackedBackgroundJobs(sessionId)
      })
    );
  }, [sessionId]);

  const refreshTabsStable = useCallback(async () => {
    const apiTabs = await listTerminalTabs(sessionId);
    for (const tab of apiTabs) {
      if (tab.kind === "app" && tab.running) {
        trackApp(sessionId, appNameFromTabId(tab.id));
      }
    }
    const jobRunning = Object.fromEntries(
      listTrackedBackgroundJobs(sessionId).map((name) => [name, true])
    );
    setTabs((prev) => {
      const merged = mergeApiTabsWithPinnedJobs({
        apiTabs,
        previous: prev,
        jobRunning
      });
      return applyTrackedRunningState(merged, {
        trackedApps: listTrackedApps(sessionId),
        trackedJobs: listTrackedBackgroundJobs(sessionId)
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
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      try {
        await refreshTabsStable();
        if (!cancelled) setError(null);
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
  }, [sessionId, refreshTabsStable]);

  return { tabs, setTabs, loading, error, setError, refreshTabsStable };
}
