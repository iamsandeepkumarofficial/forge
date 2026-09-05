import { useCallback, useEffect, useState } from "react";
import type { FileTab, WorkbenchChrome, WorkbenchTurnStatus } from "./types.js";
import { initialSplitPct, nextSplitPct } from "./workbench-split.js";
import {
  PREVIEW_TAB_ID,
  closeDocTab,
  diffTabId,
  fileTabId,
  nextActiveAfterClose,
  upsertDocTab
} from "./right-tabs.js";

export function useWorkbenchDocs() {
  const [docs, setDocs] = useState<FileTab[]>([]);
  const [activeRight, setActiveRight] = useState(PREVIEW_TAB_ID);
  const openFile = useCallback((path: string) => {
    const tab: FileTab = { id: fileTabId(path), kind: "file", path };
    setDocs((current) => upsertDocTab(current, tab));
    setActiveRight(tab.id);
  }, []);
  const openDiff = useCallback((repo: string, path: string) => {
    const tab: FileTab = {
      id: diffTabId(repo, path),
      kind: "diff",
      repo,
      path
    };
    setDocs((current) => upsertDocTab(current, tab));
    setActiveRight(tab.id);
  }, []);
  const closeTab = useCallback((id: string) => {
    setDocs((current) => {
      const remaining = closeDocTab(current, id);
      setActiveRight((active) =>
        nextActiveAfterClose({ activeId: active, closedId: id, remaining })
      );
      return remaining;
    });
  }, []);
  const activeDoc = docs.find((d) => d.id === activeRight) ?? null;
  return {
    docs,
    activeRight,
    activeDoc,
    setActiveRight,
    openFile,
    openDiff,
    closeTab
  };
}

export function useWorkbenchSplit(options: { previewLive: boolean }) {
  const { previewLive } = options;
  const [leftPct, setLeftPct] = useState(initialSplitPct);
  const [userOverride, setUserOverride] = useState(false);
  const [splitKey, setSplitKey] = useState(
    `${previewLive ? 1 : 0}:${userOverride ? 1 : 0}`
  );
  const nextKey = `${previewLive ? 1 : 0}:${userOverride ? 1 : 0}`;
  if (splitKey !== nextKey) {
    setSplitKey(nextKey);
    setLeftPct((current) =>
      nextSplitPct({ current, hasPreview: previewLive, userOverride })
    );
  }
  return {
    leftPct,
    setLeftPct,
    markUserOverride: () => setUserOverride(true)
  };
}

export function useWorkbenchChrome(options: {
  onChromeChange?: (chrome: WorkbenchChrome) => void;
}) {
  const { onChromeChange } = options;
  const [turnStatus, setTurnStatus] = useState<WorkbenchTurnStatus>("idle");
  useEffect(() => {
    onChromeChange?.({ turnStatus });
  }, [onChromeChange, turnStatus]);
  return { turnStatus, setTurnStatus };
}
