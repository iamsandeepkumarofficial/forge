import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from "react";
import { ChevronDown, ChevronUp, SquareTerminal, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { PreviewDevtools } from "./preview-devtools.js";
import { isElectronPreview } from "../../lib/desktop.js";
import { ElectronDevtoolsHole } from "./electron-preview-hole.js";
import {
  loadDockMode,
  loadTerminalHeight,
  loadTerminalOpen,
  persistDockMode,
  persistTerminalHeight,
  persistTerminalOpen
} from "./storage.js";
import { TerminalPane } from "./terminal-pane.js";
import {
  dockModeFromEvent,
  PREVIEW_DOCK_EVENT,
  TERMINAL_TOGGLE_EVENT,
  type PreviewDockMode
} from "./terminal-toggle.js";

const N_32 = 32;
const N_120 = 120;
const N_70 = 70;
const N_100 = 100;
const PRIMARY_BUTTON = 0;

export function BottomTerminal({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(loadTerminalOpen);
  const [mode, setMode] = useState<PreviewDockMode>(loadDockMode);
  const [runningCount, setRunningCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const modeRef = useRef(mode);
  const resize = useTerminalResize(containerRef);
  useEffect(() => {
    openRef.current = open;
    modeRef.current = mode;
  }, [open, mode]);
  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      persistTerminalOpen(next);
      return next;
    });
  }, []);
  const selectMode = useCallback((next: PreviewDockMode) => {
    setMode(next);
    persistDockMode(next);
    setOpen(true);
    persistTerminalOpen(true);
  }, []);
  const requestMode = useCallback((next: PreviewDockMode) => {
    if (openRef.current && modeRef.current === next) {
      setOpen(false);
      persistTerminalOpen(false);
      return;
    }
    setMode(next);
    persistDockMode(next);
    setOpen(true);
    persistTerminalOpen(true);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "`") return;
      e.preventDefault();
      requestMode("terminal");
    };
    const onDock = (e: Event) => {
      requestMode(dockModeFromEvent(e));
    };
    const onLegacyToggle = () => {
      requestMode("terminal");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(PREVIEW_DOCK_EVENT, onDock);
    window.addEventListener(TERMINAL_TOGGLE_EVENT, onLegacyToggle);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PREVIEW_DOCK_EVENT, onDock);
      window.removeEventListener(TERMINAL_TOGGLE_EVENT, onLegacyToggle);
    };
  }, [requestMode]);
  return (
    <DockShell
      sessionId={sessionId}
      open={open}
      mode={mode}
      runningCount={runningCount}
      containerRef={containerRef}
      resize={resize}
      onSelect={selectMode}
      onToggle={toggle}
      onRunningCount={setRunningCount}
    />
  );
}

function DockShell(options: {
  sessionId: string;
  open: boolean;
  mode: PreviewDockMode;
  runningCount: number;
  containerRef: RefObject<HTMLDivElement | null>;
  resize: ReturnType<typeof useTerminalResize>;
  onSelect: (mode: PreviewDockMode) => void;
  onToggle: () => void;
  onRunningCount: (n: number) => void;
}) {
  const {
    sessionId,
    open,
    mode,
    runningCount,
    containerRef,
    resize,
    onSelect,
    onToggle,
    onRunningCount
  } = options;
  const showTerminal = open && mode === "terminal";
  const showDevtools = open && mode === "devtools";
  return (
    <div
      ref={containerRef}
      className="flex shrink-0 flex-col border-t bg-background"
    >
      {open && resize.dragging ? (
        <div className="fixed inset-0 z-50 cursor-row-resize touch-none" />
      ) : null}
      {open ? (
        <div
          onPointerDown={resize.startDrag}
          className="h-1 shrink-0 cursor-row-resize touch-none bg-muted hover:bg-primary"
          title="Drag to resize"
        />
      ) : null}
      <DockBar
        open={open}
        mode={mode}
        runningCount={runningCount}
        onSelect={onSelect}
        onToggle={onToggle}
      />
      <div
        data-testid="terminal-body"
        hidden={!showTerminal}
        style={showTerminal ? { height: resize.height } : undefined}
        className="min-h-0"
      >
        <TerminalPane sessionId={sessionId} onRunningCount={onRunningCount} />
      </div>
      <div
        data-testid="devtools-body"
        hidden={!showDevtools}
        style={showDevtools ? { height: resize.height } : undefined}
        className="min-h-0"
      >
        {isElectronPreview() ? (
          <ElectronDevtoolsHole active={showDevtools} />
        ) : (
          <PreviewDevtools />
        )}
      </div>
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

function DockBar(options: {
  open: boolean;
  mode: PreviewDockMode;
  runningCount: number;
  onSelect: (mode: PreviewDockMode) => void;
  onToggle: () => void;
}) {
  const { open, mode, runningCount, onSelect, onToggle } = options;
  return (
    <div className="flex h-8 shrink-0 items-center gap-0.5 px-1 text-xs">
      <button
        type="button"
        aria-pressed={open && mode === "terminal"}
        onClick={() => onSelect("terminal")}
        className={dockTabClass(open && mode === "terminal")}
      >
        <Terminal className="size-3.5" />
        Terminal
      </button>
      <button
        type="button"
        aria-pressed={open && mode === "devtools"}
        onClick={() => onSelect("devtools")}
        className={dockTabClass(open && mode === "devtools")}
      >
        <SquareTerminal className="size-3.5" />
        DevTools
      </button>
      {mode === "terminal" && runningCount > 0 ? (
        <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[0.65rem] font-medium text-green-700 dark:text-green-300">
          {runningCount} running
        </span>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? "Collapse panel" : "Expand panel"}
        title={open ? "Collapse panel" : "Expand panel"}
        className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronUp className="size-3.5" />
        )}
      </button>
    </div>
  );
}

function dockTabClass(active: boolean): string {
  return cn(
    "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium uppercase tracking-wide",
    active
      ? "bg-muted text-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );
}
