import { useCallback, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TerminalTab } from "../../lib/session-terminal.js";
import {
  isBackgroundJobTracked,
  isTracked,
  trackApp
} from "./tracked-terminals.js";
import {
  appNameFromTabId,
  appTab,
  jobNameFromTabId,
  mergeShellTab,
  pinnedJobTab
} from "./terminal-model.js";
import {
  jobNameFromOpenEvent,
  OPEN_TERMINAL_JOB_EVENT,
  OPEN_TERMINAL_TAB_EVENT,
  terminalTabFromOpenEvent
} from "./terminal-toggle.js";

export function useTerminalOpenEvents(options: {
  sessionId: string;
  selectTab: (tabId: string) => void;
  setTabs: Dispatch<SetStateAction<TerminalTab[]>>;
  setHidden: Dispatch<SetStateAction<Set<string>>>;
}) {
  const { sessionId, selectTab, setTabs, setHidden } = options;

  const openJobTab = useCallback(
    (jobName: string) => {
      const running = isBackgroundJobTracked(sessionId, jobName);
      const tab = pinnedJobTab(jobName, running);
      setHidden((prev) => {
        if (!prev.has(tab.id)) return prev;
        const next = new Set(prev);
        next.delete(tab.id);
        return next;
      });
      setTabs((prev) => mergeShellTab(prev, tab));
      selectTab(tab.id);
    },
    [sessionId, selectTab, setHidden, setTabs]
  );

  const openAppTab = useCallback(
    (tabId: string) => {
      const id = tabId.startsWith("app:") ? tabId : `app:${tabId}`;
      const name = appNameFromTabId(id);
      trackApp(sessionId, name);
      const running = isTracked({ sessionId, kind: "app", name });
      setHidden((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setTabs((prev) => mergeShellTab(prev, appTab(name, running)));
      selectTab(id);
    },
    [sessionId, selectTab, setHidden, setTabs]
  );

  useEffect(() => {
    const onOpenTab = (event: Event) => {
      const detail = terminalTabFromOpenEvent(event);
      if (!detail) return;
      if (detail.kind === "job") {
        openJobTab(jobNameFromTabId(detail.id));
        return;
      }
      openAppTab(detail.id);
    };
    const onOpenJob = (event: Event) => {
      const name = jobNameFromOpenEvent(event);
      if (name) openJobTab(name);
    };
    window.addEventListener(OPEN_TERMINAL_TAB_EVENT, onOpenTab);
    window.addEventListener(OPEN_TERMINAL_JOB_EVENT, onOpenJob);
    return () => {
      window.removeEventListener(OPEN_TERMINAL_TAB_EVENT, onOpenTab);
      window.removeEventListener(OPEN_TERMINAL_JOB_EVENT, onOpenJob);
    };
  }, [openAppTab, openJobTab]);
}
