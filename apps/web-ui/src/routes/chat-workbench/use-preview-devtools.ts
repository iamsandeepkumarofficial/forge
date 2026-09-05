import { useEffect, useRef, useState } from "react";
import {
  postToPreviewInspect,
  type DevtoolsTab
} from "./preview-devtools-model.js";
import { handleDevtoolsMessage } from "./preview-devtools-message.js";
import type {
  ConsoleEntry,
  DomNode,
  NetworkEntry,
  PreviewPickSummary
} from "./preview-devtools-model.js";

export function usePreviewDevtools() {
  const [tab, setTab] = useState<DevtoolsTab>("console");
  const [logs, setLogs] = useState<ConsoleEntry[]>([]);
  const [requests, setRequests] = useState<NetworkEntry[]>([]);
  const [tree, setTree] = useState<DomNode | null>(null);
  const [treeError, setTreeError] = useState("");
  const [pick, setPick] = useState<PreviewPickSummary | null>(null);
  const [selecting, setSelecting] = useState(false);
  const seq = useRef(0);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      handleDevtoolsMessage({
        data: e.data,
        selecting,
        nextSeq: () => {
          seq.current += 1;
          return seq.current;
        },
        setLogs,
        setRequests,
        setTree,
        setTreeError,
        setPick,
        setSelecting
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [selecting]);

  useEffect(() => {
    if (tab !== "elements") return;
    postToPreviewInspect({ type: "forge-devtools-dom" });
  }, [tab]);

  useEffect(() => {
    logEnd.current?.scrollIntoView?.({ block: "end" });
  }, [logs.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !selecting) return;
      setSelecting(false);
      postToPreviewInspect({ type: "forge-inspect-set", on: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting]);

  return {
    tab,
    setTab,
    logs,
    requests,
    tree,
    treeError,
    pick,
    selecting,
    logEnd,
    clearActive: () => {
      if (tab === "network") setRequests([]);
      else setLogs([]);
    },
    toggleSelect: () => {
      const next = !selecting;
      setSelecting(next);
      postToPreviewInspect({ type: "forge-inspect-set", on: next });
    }
  };
}
