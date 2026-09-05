import type { Dispatch, SetStateAction } from "react";
import {
  capEntries,
  parseConsoleMessage,
  parseDomResult,
  parseInspectPick,
  parseNetworkMessage,
  postToPreviewInspect,
  type ConsoleEntry,
  type DomNode,
  type NetworkEntry,
  type PreviewPickSummary
} from "./preview-devtools-model.js";

export function handleDevtoolsMessage(options: {
  data: unknown;
  selecting: boolean;
  nextSeq: () => number;
  setLogs: Dispatch<SetStateAction<ConsoleEntry[]>>;
  setRequests: Dispatch<SetStateAction<NetworkEntry[]>>;
  setTree: Dispatch<SetStateAction<DomNode | null>>;
  setTreeError: Dispatch<SetStateAction<string>>;
  setPick: Dispatch<SetStateAction<PreviewPickSummary | null>>;
  setSelecting: Dispatch<SetStateAction<boolean>>;
}): void {
  const {
    data,
    selecting,
    nextSeq,
    setLogs,
    setRequests,
    setTree,
    setTreeError,
    setPick,
    setSelecting
  } = options;
  const consoleEntry = parseConsoleMessage(data);
  if (consoleEntry) {
    const id = `c${nextSeq()}`;
    setLogs((prev) => capEntries([...prev, { ...consoleEntry, id }]));
    return;
  }
  const networkEntry = parseNetworkMessage(data);
  if (networkEntry) {
    const id = `n${nextSeq()}`;
    setRequests((prev) => capEntries([...prev, { ...networkEntry, id }]));
    return;
  }
  const dom = parseDomResult(data);
  if (dom) {
    if ("error" in dom) {
      setTree(null);
      setTreeError(dom.error);
      return;
    }
    setTreeError("");
    setTree(dom);
    return;
  }
  if (!selecting) return;
  const nextPick = parseInspectPick(data);
  if (nextPick) {
    setPick(nextPick);
    setSelecting(false);
    postToPreviewInspect({ type: "forge-inspect-set", on: false });
  }
}
