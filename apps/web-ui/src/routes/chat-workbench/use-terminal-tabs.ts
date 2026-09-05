import { useCallback, useState } from "react";
import type { TerminalTab } from "../../lib/session-terminal.js";
import { pickActiveTab, pruneHiddenTabs } from "./terminal-model.js";
import { loadActiveTerminalTab, persistActiveTerminalTab } from "./storage.js";
import { useTerminalOpenEvents } from "./use-terminal-open-events.js";
import {
  closeTerminalTab,
  createTerminalShellTab
} from "./terminal-tab-actions.js";
import { useTerminalTabRefresh } from "./use-terminal-tab-refresh.js";

export function useTerminalTabs(sessionId: string) {
  const refresh = useTerminalTabRefresh(sessionId);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [activeTabId, setActiveTabId] = useState<string | null>(() =>
    loadActiveTerminalTab(sessionId)
  );
  const [busy, setBusy] = useState(false);

  const nextHidden = pruneHiddenTabs(hidden, refresh.tabs);
  const hiddenKey = [...hidden].sort().join("\0");
  const nextHiddenKey = [...nextHidden].sort().join("\0");
  if (hiddenKey !== nextHiddenKey) setHidden(nextHidden);

  const selectTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
      persistActiveTerminalTab(sessionId, tabId);
    },
    [sessionId]
  );

  const nextActive = pickActiveTab({
    tabs: refresh.tabs,
    preferredId: activeTabId,
    hidden
  });
  if (nextActive !== activeTabId) {
    setActiveTabId(nextActive);
    persistActiveTerminalTab(sessionId, nextActive);
  }

  useTerminalOpenEvents({
    sessionId,
    selectTab,
    setTabs: refresh.setTabs,
    setHidden
  });

  return {
    tabs: refresh.tabs,
    hidden,
    activeTabId,
    error: refresh.error,
    busy,
    loading: refresh.loading,
    selectTab,
    onCreateTab: () =>
      createTerminalShellTab({
        sessionId,
        busy,
        setBusy,
        setTabs: refresh.setTabs,
        selectTab,
        setError: refresh.setError
      }),
    onCloseTab: (tab: TerminalTab) =>
      closeTerminalTab({
        sessionId,
        tab,
        setBusy,
        setTabs: refresh.setTabs,
        setHidden,
        setError: refresh.setError,
        refreshTabs: refresh.refreshTabsStable
      })
  };
}
