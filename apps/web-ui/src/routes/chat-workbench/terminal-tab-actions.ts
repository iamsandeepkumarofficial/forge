import type { Dispatch, SetStateAction } from "react";
import {
  closeShellTab,
  createShellTab,
  type TerminalTab
} from "../../lib/session-terminal.js";
import { mergeShellTab } from "./terminal-model.js";

export async function createTerminalShellTab(options: {
  sessionId: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setTabs: Dispatch<SetStateAction<TerminalTab[]>>;
  selectTab: (tabId: string) => void;
  setError: (error: string | null) => void;
}): Promise<void> {
  if (options.busy) return;
  options.setBusy(true);
  try {
    const created = await createShellTab(options.sessionId);
    options.setTabs((prev) => mergeShellTab(prev, created.tab));
    options.selectTab(created.tabId);
    options.setError(null);
  } catch (err) {
    options.setError(err instanceof Error ? err.message : String(err));
  } finally {
    options.setBusy(false);
  }
}

export async function closeTerminalTab(options: {
  sessionId: string;
  tab: TerminalTab;
  setBusy: (busy: boolean) => void;
  setTabs: Dispatch<SetStateAction<TerminalTab[]>>;
  setHidden: Dispatch<SetStateAction<Set<string>>>;
  setError: (error: string | null) => void;
  refreshTabs: () => Promise<unknown>;
}): Promise<void> {
  const { tab } = options;
  if (tab.kind === "shell") {
    if (!tab.closable) return;
    options.setBusy(true);
    try {
      await closeShellTab({ sessionId: options.sessionId, tabId: tab.id });
      options.setTabs((prev) => prev.filter((entry) => entry.id !== tab.id));
      options.setError(null);
      void options.refreshTabs();
    } catch (err) {
      options.setError(err instanceof Error ? err.message : String(err));
    } finally {
      options.setBusy(false);
    }
    return;
  }
  if (tab.kind === "job") {
    options.setTabs((prev) => prev.filter((entry) => entry.id !== tab.id));
    return;
  }
  options.setHidden((prev) => new Set(prev).add(tab.id));
}
