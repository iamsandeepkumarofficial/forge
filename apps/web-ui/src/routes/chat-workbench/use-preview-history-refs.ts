import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  pushPreviewHistory,
  samePreviewUrl,
  stripCacheBust
} from "./preview-nav.js";
import type { PreviewNavInfo } from "../../lib/desktop-preview.js";

export function usePreviewHistoryRefs(options: {
  history: string[];
  histIndex: number;
  address: string;
}) {
  const historyRef = useRef(options.history);
  const histIndexRef = useRef(options.histIndex);
  const addressRef = useRef(options.address);
  useEffect(() => {
    historyRef.current = options.history;
    histIndexRef.current = options.histIndex;
    addressRef.current = options.address;
  }, [options.history, options.histIndex, options.address]);
  return { historyRef, histIndexRef, addressRef };
}

export function usePreviewNavHandler(options: {
  histIndexRef: RefObject<number>;
  setAddress: (v: string) => void;
  setHistory: (fn: (stack: string[]) => string[]) => void;
  setHistIndex: (v: number) => void;
}) {
  const { histIndexRef, setAddress, setHistory, setHistIndex } = options;
  return useCallback(
    (info: PreviewNavInfo) => {
      if (!info.url || info.url === "about:blank") return;
      const next = stripCacheBust(info.url);
      setAddress(next);
      setHistory((stack) => {
        const idx = histIndexRef.current;
        if (stack[idx] && samePreviewUrl(stack[idx], next)) return stack;
        const moved = pushPreviewHistory(stack, { index: idx, next });
        setHistIndex(moved.index);
        return moved.stack;
      });
    },
    [histIndexRef, setAddress, setHistory, setHistIndex]
  );
}
