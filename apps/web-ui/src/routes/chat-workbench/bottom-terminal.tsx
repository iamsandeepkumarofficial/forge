import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from "react";
import { DockBar } from "./bottom-dock-bar.js";
import { PreviewDevtools } from "./preview-devtools.js";
import { isElectronPreview } from "../../lib/desktop.js";
import { ElectronDevtoolsHole } from "./electron-preview-hole.js";
import {
  loadDockExtras,
  loadDockMode,
  loadTerminalHeight,
  loadTerminalOpen,
  persistDockExtras,
  persistDockMode,
  persistTerminalHeight,
  persistTerminalOpen
} from "./storage.js";
import { TerminalPane } from "./terminal-pane.js";
import {
  dockEnsureFromEvent,
  dockExtrasAfterClose,
  dockExtrasAfterOpen,
  dockModeAfterClose,
  dockModeFromEvent,
  PREVIEW_DOCK_EVENT,
  TERMINAL_TOGGLE_EVENT,
  type CloseableDockMode,
  type PreviewDockMode
} from "./terminal-toggle.js";
import {
  releaseTerminalSessionClient,
  retainTerminalSessionClient
} from "../../lib/terminal-session-registry.js";

const N_32 = 32;
const N_120 = 120;
const N_70 = 70;
const N_100 = 100;
const PRIMARY_BUTTON = 0;

function bindDockListeners(options: {
  requestMode: (next: PreviewDockMode) => void;
  selectMode: (next: PreviewDockMode) => void;
}): () => void {
  const { requestMode, selectMode } = options;
  const onKey = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.key !== "`") return;
    e.preventDefault();
    requestMode("terminal");
  };
  const onDock = (e: Event) => {
    const nextMode = dockModeFromEvent(e);
    if (dockEnsureFromEvent(e)) {
      selectMode(nextMode);
      return;
    }
    requestMode(nextMode);
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
}

export function BottomTerminal({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(loadTerminalOpen);
  const [mode, setMode] = useState<PreviewDockMode>(loadDockMode);
  const [extras, setExtras] = useState<CloseableDockMode[]>(loadDockExtras);
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
    setExtras((prev) => {
      const extrasNext = dockExtrasAfterOpen(prev, next);
      persistDockExtras(extrasNext);
      return extrasNext;
    });
    setMode(next);
    persistDockMode(next);
    setOpen(true);
    persistTerminalOpen(true);
  }, []);
  const closeExtra = useCallback((extra: CloseableDockMode) => {
    setExtras((prev) => {
      const extrasNext = dockExtrasAfterClose(prev, extra);
      persistDockExtras(extrasNext);
      return extrasNext;
    });
    setMode((current) => {
      const next = dockModeAfterClose(current, extra);
      persistDockMode(next);
      return next;
    });
  }, []);
  const requestMode = useCallback(
    (next: PreviewDockMode) => {
      if (openRef.current && modeRef.current === next) {
        setOpen(false);
        persistTerminalOpen(false);
        return;
      }
      selectMode(next);
    },
    [selectMode]
  );
  useEffect(
    () => bindDockListeners({ requestMode, selectMode }),
    [requestMode, selectMode]
  );
  useEffect(() => {
    retainTerminalSessionClient(sessionId);
    return () => {
      releaseTerminalSessionClient(sessionId);
    };
  }, [sessionId]);
  return (
    <DockShell
      sessionId={sessionId}
      open={open}
      mode={mode}
      extras={extras}
      containerRef={containerRef}
      resize={resize}
      onSelect={selectMode}
      onCloseExtra={closeExtra}
      onToggle={toggle}
    />
  );
}

function DockShell(options: {
  sessionId: string;
  open: boolean;
  mode: PreviewDockMode;
  extras: CloseableDockMode[];
  containerRef: RefObject<HTMLDivElement | null>;
  resize: ReturnType<typeof useTerminalResize>;
  onSelect: (mode: PreviewDockMode) => void;
  onCloseExtra: (extra: CloseableDockMode) => void;
  onToggle: () => void;
}) {
  const {
    sessionId,
    open,
    mode,
    extras,
    containerRef,
    resize,
    onSelect,
    onCloseExtra,
    onToggle
  } = options;
  const showTerminal = open && mode === "terminal";
  const showDevtools =
    open && mode === "devtools" && extras.includes("devtools");
  const [fitSignal, setFitSignal] = useState(0);
  useEffect(() => {
    if (!showTerminal) return;
    void Promise.resolve().then(() => {
      setFitSignal((n) => n + 1);
    });
  }, [showTerminal, resize.height, resize.dragging]);
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
        extras={extras}
        onSelect={onSelect}
        onCloseExtra={onCloseExtra}
        onToggle={onToggle}
      />
      <DockBodies
        sessionId={sessionId}
        extras={extras}
        showTerminal={showTerminal}
        showDevtools={showDevtools}
        height={resize.height}
        fitSignal={fitSignal}
      />
    </div>
  );
}

function DockBodies(options: {
  sessionId: string;
  extras: CloseableDockMode[];
  showTerminal: boolean;
  showDevtools: boolean;
  height: number;
  fitSignal: number;
}) {
  const { sessionId, extras, showTerminal, showDevtools, height, fitSignal } =
    options;
  return (
    <>
      <div
        data-testid="terminal-body"
        hidden={!showTerminal}
        style={showTerminal ? { height } : undefined}
        className="min-h-0 overflow-hidden"
      >
        <TerminalPane
          sessionId={sessionId}
          visible={showTerminal}
          fitSignal={fitSignal}
        />
      </div>
      {extras.includes("devtools") ? (
        <div
          data-testid="devtools-body"
          hidden={!showDevtools}
          style={showDevtools ? { height } : undefined}
          className="min-h-0"
        >
          {isElectronPreview() ? (
            <ElectronDevtoolsHole active={showDevtools} />
          ) : (
            <PreviewDevtools />
          )}
        </div>
      ) : null}
    </>
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
