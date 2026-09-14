import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  clampTerminalTabListWidth,
  loadTerminalTabListWidth,
  persistTerminalTabListWidth
} from "./storage.js";

const PRIMARY_BUTTON = 0;

function detachTabListResizeListeners(options: {
  onMove: (e: PointerEvent) => void;
  onUp: () => void;
}) {
  const { onMove, onUp } = options;
  document.removeEventListener("pointermove", onMove, true);
  document.removeEventListener("pointerup", onUp, true);
  document.removeEventListener("pointercancel", onUp, true);
}

export function useTabListResize() {
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
    setWidth(clampTerminalTabListWidth(origin.width + (e.clientX - origin.x)));
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
