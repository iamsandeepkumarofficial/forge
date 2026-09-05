import type { TerminalSessionClient } from "../../lib/terminal-session-client.js";
import type { TerminalTab } from "../../lib/session-terminal.js";
import { jobNameFromTabId } from "./terminal-model.js";
import {
  AppLogXtermPane,
  JobLogXtermPane,
  ShellXtermPane
} from "./terminal-xterm-view.js";

export function TerminalBodies(options: {
  loading: boolean;
  shownTabs: TerminalTab[];
  sessionClient: TerminalSessionClient | null;
  activeTabId: string | null;
  dockVisible: boolean;
  paneFitSignal: number;
}) {
  const {
    loading,
    shownTabs,
    sessionClient,
    activeTabId,
    dockVisible,
    paneFitSignal
  } = options;
  if (loading && shownTabs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-950 p-2 font-mono text-[0.7rem] text-gray-500">
        Loading terminals…
      </div>
    );
  }
  if (shownTabs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-950 p-2 font-mono text-[0.7rem] text-gray-500">
        No tabs yet. Create a shell tab to start.
      </div>
    );
  }
  if (!sessionClient) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-950 p-2 font-mono text-[0.7rem] text-gray-500">
        Connecting session…
      </div>
    );
  }
  return (
    <>
      {shownTabs.map((tab) => (
        <TerminalBody
          key={tab.id}
          tab={tab}
          sessionClient={sessionClient}
          active={tab.id === activeTabId}
          dockVisible={dockVisible}
          paneFitSignal={paneFitSignal}
        />
      ))}
    </>
  );
}

function TerminalBody(options: {
  tab: TerminalTab;
  sessionClient: TerminalSessionClient;
  active: boolean;
  dockVisible: boolean;
  paneFitSignal: number;
}) {
  const { tab, sessionClient, active, dockVisible, paneFitSignal } = options;
  const appName = tab.kind === "app" ? tab.id.slice(4) : "";
  const jobName = tab.kind === "job" ? jobNameFromTabId(tab.id) : "";
  return (
    <div hidden={!active} className="absolute inset-0 min-h-0 overflow-hidden">
      {tab.kind === "shell" ? (
        <ShellXtermPane
          client={sessionClient}
          tabId={tab.id}
          active={active}
          visible={dockVisible && active}
          fitSignal={paneFitSignal}
        />
      ) : tab.kind === "job" ? (
        <JobLogXtermPane
          client={sessionClient}
          jobName={jobName}
          tabId={tab.id}
          active={active}
          visible={dockVisible}
          running={tab.running}
          fitSignal={paneFitSignal}
        />
      ) : (
        <AppLogXtermPane
          client={sessionClient}
          appName={appName}
          tabId={tab.id}
          active={active}
          visible={dockVisible}
          running={tab.running}
          fitSignal={paneFitSignal}
        />
      )}
    </div>
  );
}
