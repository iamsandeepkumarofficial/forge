import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from "react";
import { ChevronDown, ChevronUp, SquareTerminal } from "lucide-react";
import {
  loadTerminalHeight,
  loadTerminalOpen,
  persistTerminalHeight,
  persistTerminalOpen
} from "./storage.js";
import { TerminalPane } from "./terminal-pane.js";

const N_32 = 32;
const N_120 = 120;
const N_70 = 70;
const N_100 = 100;
const PRIMARY_BUTTON = 0;

export function BottomTerminal({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(loadTerminalOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const resize = useTerminalResize(containerRef);
  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      persistTerminalOpen(next);
      return next;
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "`") return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
  return (
    <div
      ref={containerRef}
      className="flex shrink-0 flex-col border-t bg-background"
    >
      {open ? (
        <ExpandedTerminal
          sessionId={sessionId}
          height={resize.height}
          dragging={resize.dragging}
          onDragStart={resize.startDrag}
          onToggle={toggle}
        />
      ) : (
        <TerminalBar open={false} onToggle={toggle} />
      )}
    </div>
  );
}

function heightFromPointer(options: {
  shell: DOMRect;
  clientY: number;
}): number {
  const { shell, clientY } = options;
  const max = (shell.height * N_70) / N_100;
  const next = shell.bottom - clientY - N_32;
  return Math.min(max, Math.max(N_120, next));
}

function detachResizeListeners(options: {
  onMove: (e: PointerEvent) => void;
  onUp: () => void;
}) {
  const { onMove, onUp } = options;
  document.removeEventListener("pointermove", onMove, true);
  document.removeEventListener("pointerup", onUp, true);
  document.removeEventListener("pointercancel", onUp, true);
}

function useTerminalResize(containerRef: RefObject<HTMLDivElement | null>) {
  const [height, setHeight] = useState(loadTerminalHeight);
  const [dragging, setDragging] = useState(false);
  const heightRef = useRef(height);
  const draggingRef = useRef(false);
  useEffect(() => {
    heightRef.current = height;
  }, [height]);
  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current || !Number.isFinite(e.clientY)) return;
      const shell = containerRef.current?.parentElement;
      if (!shell) return;
      setHeight(
        heightFromPointer({
          shell: shell.getBoundingClientRect(),
          clientY: e.clientY
        })
      );
    },
    [containerRef]
  );
  const onPointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    persistTerminalHeight(heightRef.current);
  }, []);
  const startDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button > PRIMARY_BUTTON) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      draggingRef.current = true;
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
        detachResizeListeners({ onMove: onPointerMove, onUp: onPointerUp });
    }
    detachResizeListeners({ onMove: onPointerMove, onUp: onPointerUp });
    return undefined;
  }, [dragging, onPointerMove, onPointerUp]);
  return { height, dragging, startDrag };
}

function ExpandedTerminal(options: {
  sessionId: string;
  height: number;
  dragging: boolean;
  onDragStart: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onToggle: () => void;
}) {
  const { sessionId, height, dragging, onDragStart, onToggle } = options;
  return (
    <>
      {dragging ? (
        <div className="fixed inset-0 z-50 cursor-row-resize touch-none" />
      ) : null}
      <div
        onPointerDown={onDragStart}
        className="h-1 shrink-0 cursor-row-resize touch-none bg-muted hover:bg-primary"
        title="Drag to resize"
      />
      <TerminalBar open onToggle={onToggle} />
      <div style={{ height }} className="min-h-0">
        <TerminalPane sessionId={sessionId} />
      </div>
    </>
  );
}

function TerminalBar(options: { open: boolean; onToggle: () => void }) {
  const { open, onToggle } = options;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-8 shrink-0 items-center gap-1.5 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-expanded={open}
      title={open ? "Collapse terminal" : "Expand terminal"}
    >
      <SquareTerminal className="size-3.5" />
      <span className="font-medium uppercase tracking-wide">Terminal</span>
      {open ? (
        <ChevronDown className="ml-auto size-3.5" />
      ) : (
        <ChevronUp className="ml-auto size-3.5" />
      )}
    </button>
  );
}
