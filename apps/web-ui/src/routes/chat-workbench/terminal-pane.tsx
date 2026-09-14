import { useEffect, useMemo, useState } from "react";
import type { TerminalSessionClient } from "../../lib/terminal-session-client.js";
import {
  getTerminalSessionClient,
  releaseTerminalSessionClient,
  retainTerminalSessionClient
} from "../../lib/terminal-session-registry.js";
import { partitionStripTabs, visibleTabs } from "./terminal-model.js";
import { useTabListResize } from "./use-tab-list-resize.js";
import { useTerminalTabs } from "./use-terminal-tabs.js";
import { TerminalTabList } from "./terminal-tab-list.js";
import { TerminalBodies } from "./terminal-bodies.js";

export function TerminalPane(options: {
  sessionId: string;
  visible: boolean;
  fitSignal: number;
}) {
  const { sessionId, visible: dockVisible, fitSignal } = options;
  const listResize = useTabListResize();
  const paneFitSignal = fitSignal + listResize.width;
  const tabsState = useTerminalTabs(sessionId);
  const [sessionClient, setSessionClient] =
    useState<TerminalSessionClient | null>(() =>
      getTerminalSessionClient(sessionId)
    );

  useEffect(() => {
    const client = retainTerminalSessionClient(sessionId);
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setSessionClient(client);
    });
    return () => {
      cancelled = true;
      releaseTerminalSessionClient(sessionId);
      void Promise.resolve().then(() => {
        setSessionClient(getTerminalSessionClient(sessionId));
      });
    };
  }, [sessionId]);

  const shownTabs = useMemo(
    () => visibleTabs(tabsState.tabs, tabsState.hidden),
    [tabsState.tabs, tabsState.hidden]
  );
  const { shells, apps, jobs } = useMemo(
    () => partitionStripTabs(shownTabs),
    [shownTabs]
  );

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      {listResize.dragging ? (
        <div className="fixed inset-0 z-50 cursor-col-resize touch-none" />
      ) : null}
      <TerminalTabList
        width={listResize.width}
        shells={shells}
        apps={apps}
        jobs={jobs}
        activeTabId={tabsState.activeTabId}
        busy={tabsState.busy}
        error={tabsState.error}
        onSelect={tabsState.selectTab}
        onClose={(tab) => void tabsState.onCloseTab(tab)}
        onCreate={() => void tabsState.onCreateTab()}
        onResizePointerDown={listResize.startDrag}
      />
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <TerminalBodies
          loading={tabsState.loading}
          shownTabs={shownTabs}
          sessionClient={sessionClient}
          activeTabId={tabsState.activeTabId}
          dockVisible={dockVisible}
          paneFitSignal={paneFitSignal}
        />
      </div>
    </div>
  );
}
