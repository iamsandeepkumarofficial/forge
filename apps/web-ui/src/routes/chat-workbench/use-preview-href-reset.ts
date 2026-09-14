import { useEffect } from "react";
import { ZOOM_DEFAULT } from "./preview-overflow.js";

function stackSharesOrigin(stack: string[], href: string): boolean {
  return stack.some((url) => {
    try {
      return new URL(url).origin === new URL(href).origin;
    } catch {
      return false;
    }
  });
}

export function usePreviewHrefReset(options: {
  previewHref: string;
  setAddress: (v: string) => void;
  setHistory: (fn: (stack: string[]) => string[]) => void;
  setHistIndex: (v: number) => void;
  setApiPath: (v: string) => void;
  setZoom: (v: number) => void;
  setCacheBust: (v: number | ((n: number) => number)) => void;
}) {
  const {
    previewHref,
    setAddress,
    setHistory,
    setHistIndex,
    setApiPath,
    setZoom,
    setCacheBust
  } = options;
  useEffect(() => {
    if (!previewHref) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setHistory((stack) => {
        if (stackSharesOrigin(stack, previewHref) && stack.length > 0) {
          return stack;
        }
        setAddress(previewHref);
        setHistIndex(0);
        setApiPath("/");
        setZoom(ZOOM_DEFAULT);
        setCacheBust(0);
        return [previewHref];
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    previewHref,
    setAddress,
    setHistory,
    setHistIndex,
    setApiPath,
    setZoom,
    setCacheBust
  ]);
}
