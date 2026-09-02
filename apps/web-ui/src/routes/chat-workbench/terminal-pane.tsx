import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import {
  closeShellTab,
  createShellTab,
  listTerminalTabs,
  type TerminalTab
} from "../../lib/session-terminal.js";
import type { TerminalSessionClient } from "../../lib/terminal-session-client.js";
import {
  getTerminalSessionClient,
  releaseTerminalSessionClient,
  retainTerminalSessionClient
} from "../../lib/terminal-session-registry.js";
import {
  isBackgroundJobTracked,
  listTrackedApps,
  listTrackedBackgroundJobs,
  subscribeTrackedTerminals,
  trackApp
} from "./tracked-terminals.js";
import {
  appNameFromTabId,
  appTab,
  applyTrackedRunningState,
  jobNameFromTabId,
  mergeApiTabsWithPinnedJobs,
  mergeShellTab,
  partitionStripTabs,
  pickActiveTab,
  pinnedJobTab,
  pruneHiddenTabs,
  visibleTabs
} from "./terminal-model.js";
import {
  clampTerminalTabListWidth,
  loadActiveTerminalTab,
  loadTerminalTabListWidth,
  persistActiveTerminalTab,
  persistTerminalTabListWidth
} from "./storage.js";
import {
  jobNameFromOpenEvent,
  OPEN_TERMINAL_JOB_EVENT,
  OPEN_TERMINAL_TAB_EVENT,
  terminalTabFromOpenEvent
} from "./terminal-toggle.js";
import {
  AppLogXtermPane,
  JobLogXtermPane,
  ShellXtermPane
} from "./terminal-xterm-view.js";

const PRIMARY_BUTTON = 0;

export function TerminalPane(options: {
  sessionId: string;
  visible: boolean;
  fitSignal: number;
}) {
  const { sessionId, visible: dockVisible, fitSignal } = options;
  const listResize = useTabListResize();
  const paneFitSignal = fitSignal + listResize.width;
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [activeTabId, setActiveTabId] = useState<string | null>(() =>
    loadActiveTerminalTab(sessionId)
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionClient, setSessionClient] =
    useState<TerminalSessionClient | null>(() =>
      getTerminalSessionClient(sessionId)
    );

  useEffect(() => {
    const client = retainTerminalSessionClient(sessionId);
    setSessionClient(client);
    return () => {
      releaseTerminalSessionClient(sessionId);
      setSessionClient(getTerminalSessionClient(sessionId));
    };
  }, [sessionId]);

  const shownTabs = useMemo(() => visibleTabs(tabs, hidden), [tabs, hidden]);
  const { shells, apps, jobs } = useMemo(
    () => partitionStripTabs(shownTabs),
    [shownTabs]
  );

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
      const merged = mergeApiTabsWithPinnedJobs(apiTabs, prev, jobRunning);
      return applyTrackedRunningState(merged, {
        trackedApps: listTrackedApps(sessionId),
        trackedJobs: listTrackedBackgroundJobs(sessionId)
      });
    });
    return apiTabs;
  }, [sessionId]);

  useEffect(() => {
    return subscribeTrackedTerminals(() => {
      syncTracked();
    });
  }, [syncTracked]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const boot = async () => {
      try {
        if (cancelled) return;
        await refreshTabsStable();
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [sessionId, refreshTabsStable]);

  useEffect(() => {
    setHidden((prev) => pruneHiddenTabs(prev, tabs));
  }, [tabs]);

  const selectTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
      persistActiveTerminalTab(sessionId, tabId);
    },
    [sessionId]
  );

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
    [sessionId, selectTab]
  );

  const openAppTab = useCallback(
    (tabId: string) => {
      const id = tabId.startsWith("app:") ? tabId : `app:${tabId}`;
      const name = appNameFromTabId(id);
      trackApp(sessionId, name);
      const tab = appTab(name, true);
      setHidden((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setTabs((prev) => mergeShellTab(prev, tab));
      selectTab(id);
    },
    [sessionId, selectTab]
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

  useEffect(() => {
    const next = pickActiveTab(tabs, activeTabId, hidden);
    if (next !== activeTabId) {
      setActiveTabId(next);
      persistActiveTerminalTab(sessionId, next);
    }
  }, [tabs, hidden, activeTabId, sessionId]);

  const onCreateTab = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const created = await createShellTab(sessionId);
      setTabs((prev) => mergeShellTab(prev, created.tab));
      selectTab(created.tabId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onCloseTab = async (tab: TerminalTab) => {
    if (tab.kind === "shell") {
      if (!tab.closable) return;
      setBusy(true);
      try {
        await closeShellTab(sessionId, tab.id);
        setTabs((prev) => prev.filter((entry) => entry.id !== tab.id));
        setError(null);
        void refreshTabsStable();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (tab.kind === "job") {
      setTabs((prev) => prev.filter((entry) => entry.id !== tab.id));
      return;
    }
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(tab.id);
      return next;
    });
  };

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      {listResize.dragging ? (
        <div className="fixed inset-0 z-50 cursor-col-resize touch-none" />
      ) : null}
      <div
        data-testid="terminal-tab-list"
        style={{ width: listResize.width }}
        className="flex shrink-0 flex-col gap-0.5 overflow-y-auto bg-gray-950 px-1 py-1"
      >
        {shells.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            onSelect={() => selectTab(tab.id)}
            onClose={() => void onCloseTab(tab)}
          />
        ))}
        {apps.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            onSelect={() => selectTab(tab.id)}
            onClose={() => void onCloseTab(tab)}
          />
        ))}
        {jobs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            onSelect={() => selectTab(tab.id)}
            onClose={() => void onCloseTab(tab)}
          />
        ))}
        <button
          type="button"
          aria-label="New shell tab"
          title="New shell tab"
          disabled={busy}
          onClick={() => void onCreateTab()}
          className="inline-flex h-6 items-center justify-center gap-1 rounded border border-dashed border-gray-700 px-1.5 text-[0.65rem] text-gray-400 hover:border-gray-500 hover:bg-gray-900 hover:text-gray-200 disabled:opacity-40"
        >
          <Plus className="size-3" />
          Shell
        </button>
        {busy ? (
          <span className="px-1 text-[0.65rem] text-gray-500">Creating…</span>
        ) : null}
        {error ? (
          <span className="truncate px-1 text-[0.65rem] text-red-400">
            {error}
          </span>
        ) : null}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize terminal tab list"
        title="Drag to resize tab list"
        onPointerDown={listResize.startDrag}
        className="w-1 shrink-0 cursor-col-resize touch-none bg-gray-900 hover:bg-gray-600"
      />
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {loading && shownTabs.length === 0 ? (
          <div className="flex h-full items-center justify-center bg-gray-950 p-2 font-mono text-[0.7rem] text-gray-500">
            Loading terminals…
          </div>
        ) : shownTabs.length === 0 ? (
          <div className="flex h-full items-center justify-center bg-gray-950 p-2 font-mono text-[0.7rem] text-gray-500">
            No tabs yet. Create a shell tab to start.
          </div>
        ) : !sessionClient ? (
          <div className="flex h-full items-center justify-center bg-gray-950 p-2 font-mono text-[0.7rem] text-gray-500">
            Connecting session…
          </div>
        ) : (
          shownTabs.map((tab) => {
            const appName = tab.kind === "app" ? tab.id.slice(4) : "";
            const jobName =
              tab.kind === "job" ? jobNameFromTabId(tab.id) : "";
            return (
              <div
                key={tab.id}
                hidden={tab.id !== activeTabId}
                className="absolute inset-0 min-h-0 overflow-hidden"
              >
                {tab.kind === "shell" ? (
                  <ShellXtermPane
                    client={sessionClient}
                    tabId={tab.id}
                    active={tab.id === activeTabId}
                    visible={dockVisible && tab.id === activeTabId}
                    fitSignal={paneFitSignal}
                  />
                ) : tab.kind === "job" ? (
                  <JobLogXtermPane
                    client={sessionClient}
                    jobName={jobName}
                    tabId={tab.id}
                    active={tab.id === activeTabId}
                    visible={dockVisible}
                    running={tab.running}
                    fitSignal={paneFitSignal}
                  />
                ) : (
                  <AppLogXtermPane
                    client={sessionClient}
                    appName={appName}
                    tabId={tab.id}
                    active={tab.id === activeTabId}
                    visible={dockVisible}
                    running={tab.running}
                    fitSignal={paneFitSignal}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function detachTabListResizeListeners(options: {
  onMove: (e: PointerEvent) => void;
  onUp: () => void;
}) {
  const { onMove, onUp } = options;
  document.removeEventListener("pointermove", onMove, true);
  document.removeEventListener("pointerup", onUp, true);
  document.removeEventListener("pointercancel", onUp, true);
}

function useTabListResize() {
  const [width, setWidth] = useState(loadTerminalTabListWidth);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(width);
  const draggingRef = useRef(false);
  const originRef = useRef<{ x: number; width: number } | null>(null);
  useEffect(() => {
    widthRef.current = width;
  }, [width]);
  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!draggingRef.current || !Number.isFinite(e.clientX)) return;
    const origin = originRef.current;
    if (!origin) return;
    setWidth(
      clampTerminalTabListWidth(origin.width + (e.clientX - origin.x))
    );
  }, []);
  const onPointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    originRef.current = null;
    setDragging(false);
    persistTerminalTabListWidth(widthRef.current);
  }, []);
  const startDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button > PRIMARY_BUTTON) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      draggingRef.current = true;
      originRef.current = { x: e.clientX, width: widthRef.current };
      setDragging(true);
      document.addEventListener("pointermove", onPointerMove, true);
      document.addEventListener("pointerup", onPointerUp, true);
      document.addEventListener("pointercancel", onPointerUp, true);
    },
    [onPointerMove, onPointerUp]
  );
  useEffect(() => {
    if (dragging) {
      return () =>
        detachTabListResizeListeners({
          onMove: onPointerMove,
          onUp: onPointerUp
        });
    }
    detachTabListResizeListeners({ onMove: onPointerMove, onUp: onPointerUp });
    return undefined;
  }, [dragging, onPointerMove, onPointerUp]);
  return { width, dragging, startDrag };
}

function TabButton(options: {
  tab: TerminalTab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const { tab, active, onSelect, onClose } = options;
  const showRunning =
    (tab.kind === "app" || tab.kind === "job") && tab.running;
  return (
    <span
      className={`group flex w-full items-center gap-1 rounded px-1.5 py-1 text-[0.65rem] ${
        active
          ? "bg-gray-800 text-gray-100"
          : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        {showRunning ? (
          <LoaderCircle
            className="size-3 shrink-0 animate-spin text-gray-300 [animation-duration:2.8s]"
            aria-label="Running"
          />
        ) : null}
        <span className="truncate">{tab.label}</span>
      </button>
      {tab.closable ? (
        <button
          type="button"
          aria-label={`Close ${tab.label}`}
          title="Close tab"
          onClick={onClose}
          className="shrink-0 text-gray-500 opacity-60 hover:text-gray-200 group-hover:opacity-100"
        >
          <X className="size-2.5" />
        </button>
      ) : null}
    </span>
  );
}
