import { useCallback, useEffect, useRef } from "react";
import { SPLIT_KEY } from "./storage.js";
import {
  clampSplitPct,
  leftPctForMinWidth,
  shouldCollapseLeft
} from "./workbench-split.js";

const N_100 = 100;

export function useResizableSplitDrag(options: {
  leftPct: number;
  onDragStart: () => void;
  onLeftPct: (pct: number) => void;
  onCollapse: () => void;
  onExpand: () => void;
}) {
  const { leftPct, onDragStart, onLeftPct, onCollapse, onExpand } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const leftPctRef = useRef(leftPct);
  useEffect(() => {
    leftPctRef.current = leftPct;
  }, [leftPct]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * N_100;
      if (shouldCollapseLeft(rect.width, pct)) {
        dragging.current = false;
        onCollapse();
        return;
      }
      onLeftPct(clampSplitPct(pct));
    },
    [onCollapse, onLeftPct]
  );

  const start = () => {
    dragging.current = true;
    onDragStart();
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      try {
        localStorage.setItem(SPLIT_KEY, String(Math.round(leftPctRef.current)));
      } catch {
        void 0;
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const expand = () => {
    const width = containerRef.current?.getBoundingClientRect().width ?? 0;
    if (width > 0 && shouldCollapseLeft(width, leftPct)) {
      onLeftPct(leftPctForMinWidth(width));
    }
    onExpand();
  };

  return { containerRef, start, expand };
}
