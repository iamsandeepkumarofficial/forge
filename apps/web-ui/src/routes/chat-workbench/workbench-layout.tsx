import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode
} from "react";
import {
  FileText,
  GitCompareArrows,
  Globe,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  X
} from "lucide-react";
import { ChatPane } from "./chat-pane.js";
import { ChangesTab, FileTabPane, FilesTab } from "./files-panels.js";
import { AppPreviewPane } from "./run-panels.js";
import { RunSidebar } from "./run-sidebar.js";
import { BottomTerminal } from "./bottom-terminal.js";
import { useApps } from "./use-apps.js";
import { SPLIT_KEY } from "./storage.js";
import { useCollapsibleSidebar } from "../../hooks/use-collapsible-sidebar.js";
import { cn } from "@/lib/utils";
import type {
  FileTab,
  LeftPaneMode,
  WorkbenchChrome,
  WorkbenchTurnStatus
} from "./types.js";
import {
  clampSplitPct,
  initialSplitPct,
  leftPctForMinWidth,
  nextSplitPct,
  shouldCollapseLeft
} from "./workbench-split.js";
import {
  PREVIEW_TAB_ID,
  closeDocTab,
  diffTabId,
  fileTabId,
  nextActiveAfterClose,
  tabLabel,
  upsertDocTab
} from "./right-tabs.js";

const N_100 = 100;

function hasRunningPreviewUrl(
  apps: { type: string; running: boolean; url?: string }[]
): boolean {
  return apps.some((a) => a.type === "web" && a.running && Boolean(a.url));
}

const WORKBENCH_LEFT_KEY = "forge:workbench-left-collapsed";

const MODE_ICON: Record<LeftPaneMode, typeof MessageSquare> = {
  chat: MessageSquare,
  files: FileText,
  changes: GitCompareArrows,
  run: Play
};

function LeftPaneRail(options: { mode: LeftPaneMode; onToggle: () => void }) {
  const { mode, onToggle } = options;
  const ModeIcon = MODE_ICON[mode];
  return (
    <div className="flex h-full shrink-0 flex-col items-center gap-1 border-r bg-muted py-2">
      <button
        type="button"
        aria-label="Expand panel"
        title="Expand panel"
        onClick={onToggle}
        className="inline-flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <ModeIcon className="size-4" />
      </button>
      <div className="mt-auto">
        <button
          type="button"
          aria-label="Expand panel"
          title="Expand panel"
          onClick={onToggle}
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ResizableSplit(options: {
  left: ReactNode;
  right: ReactNode;
  leftCollapsed: boolean;
  leftRail?: (expand: () => void) => ReactNode;
  leftPct: number;
  onDragStart: () => void;
  onLeftPct: (pct: number) => void;
  onCollapse: () => void;
  onExpand: () => void;
}) {
  const {
    left,
    right,
    leftCollapsed,
    leftRail,
    leftPct,
    onDragStart,
    onLeftPct,
    onCollapse,
    onExpand
  } = options;
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
        localStorage.setItem(
          SPLIT_KEY,
          String(Math.round(leftPctRef.current))
        );
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
  return (
    <div ref={containerRef} className="flex h-full min-h-0">
      {leftCollapsed ? (
        <div className="w-12 shrink-0">{leftRail?.(expand)}</div>
      ) : null}
      <div
        className={cn("min-w-0 border-r", leftCollapsed && "hidden")}
        style={leftCollapsed ? undefined : { width: `${leftPct}%` }}
      >
        {left}
      </div>
      {leftCollapsed ? null : (
        <div
          onPointerDown={start}
          className="relative w-1 shrink-0 cursor-col-resize bg-muted hover:bg-primary"
          title="Drag to resize"
        >
          <button
            type="button"
            aria-label="Collapse panel"
            title="Collapse panel"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onCollapse}
            className="absolute left-1/2 top-2 z-10 inline-flex size-6 -translate-x-1/2 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
          >
            <PanelLeftClose className="size-3.5" />
          </button>
        </div>
      )}
      <div className="min-w-0 flex-1">{right}</div>
    </div>
  );
}

function WorkbenchLeft(options: {
  sessionId: string;
  projectId: string;
  chatId: string;
  sessionKind: "ticket" | "workbench";
  workspaceId?: string;
  branchName?: string;
  initialPrompt?: string;
  leftMode: LeftPaneMode;
  onOpenFile: (path: string) => void;
  onOpenDiff: (repo: string, path: string) => void;
  onShowPreview: () => void;
  onTurnStatus: (status: WorkbenchTurnStatus) => void;
}) {
  const o = options;
  return (
    <div className="flex h-full flex-col">
      <div className={cn("min-h-0 flex-1", o.leftMode !== "chat" && "hidden")}>
        <ChatPane
          sessionId={o.sessionId}
          projectId={o.projectId}
          chatId={o.chatId}
          sessionKind={o.sessionKind}
          workspaceId={o.workspaceId}
          branchName={o.branchName}
          initialPrompt={o.initialPrompt}
          onOpenFile={o.onOpenFile}
          onTurnStatus={o.onTurnStatus}
        />
      </div>
      {o.leftMode === "files" ? (
        <div className="min-h-0 flex-1">
          <FilesTab sessionId={o.sessionId} onOpen={o.onOpenFile} />
        </div>
      ) : null}
      {o.leftMode === "changes" ? (
        <div className="min-h-0 flex-1">
          <ChangesTab
            sessionId={o.sessionId}
            onRepo={() => undefined}
            onOpen={o.onOpenDiff}
          />
        </div>
      ) : null}
      {o.leftMode === "run" ? (
        <div className="min-h-0 flex-1">
          <RunSidebar sessionId={o.sessionId} onShowPreview={o.onShowPreview} />
        </div>
      ) : null}
    </div>
  );
}

export function Workbench(options: {
  sessionId: string;
  projectId: string;
  chatId: string;
  sessionKind: "ticket" | "workbench";
  workspaceId?: string;
  branchName?: string;
  initialPrompt?: string;
  leftMode: LeftPaneMode;
  onLeftModeChange: (mode: LeftPaneMode) => void;
  onChromeChange?: (chrome: WorkbenchChrome) => void;
}) {
  const {
    sessionId,
    projectId,
    chatId,
    sessionKind,
    workspaceId,
    branchName,
    initialPrompt,
    leftMode,
    onLeftModeChange,
    onChromeChange
  } = options;
  const { collapsed, setCollapsed } = useCollapsibleSidebar(WORKBENCH_LEFT_KEY);
  const { apps } = useApps(sessionId);
  const previewLive = hasRunningPreviewUrl(apps);
  const [leftPct, setLeftPct] = useState(initialSplitPct);
  const [userOverride, setUserOverride] = useState(false);
  const [turnStatus, setTurnStatus] = useState<WorkbenchTurnStatus>("idle");
  const [docs, setDocs] = useState<FileTab[]>([]);
  const [activeRight, setActiveRight] = useState(PREVIEW_TAB_ID);

  useEffect(() => {
    setLeftPct((current) =>
      nextSplitPct({ current, hasPreview: previewLive, userOverride })
    );
  }, [previewLive, userOverride]);

  useEffect(() => {
    onChromeChange?.({ turnStatus });
  }, [onChromeChange, turnStatus]);

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
      setActiveRight((active) => nextActiveAfterClose(active, id, remaining));
      return remaining;
    });
  }, []);

  const activeDoc = docs.find((d) => d.id === activeRight) ?? null;

  return (
    <ResizableSplit
      leftCollapsed={collapsed}
      leftRail={(expand) => (
        <LeftPaneRail mode={leftMode} onToggle={expand} />
      )}
      leftPct={leftPct}
      onLeftPct={setLeftPct}
      onDragStart={() => setUserOverride(true)}
      onCollapse={() => setCollapsed(true)}
      onExpand={() => setCollapsed(false)}
      left={
        <WorkbenchLeft
          sessionId={sessionId}
          projectId={projectId}
          chatId={chatId}
          sessionKind={sessionKind}
          workspaceId={workspaceId}
          branchName={branchName}
          initialPrompt={initialPrompt}
          leftMode={leftMode}
          onOpenFile={openFile}
          onOpenDiff={openDiff}
          onShowPreview={() => setActiveRight(PREVIEW_TAB_ID)}
          onTurnStatus={setTurnStatus}
        />
      }
      right={
        <RightStage
          sessionId={sessionId}
          docs={docs}
          activeId={activeRight}
          activeDoc={activeDoc}
          onSelect={setActiveRight}
          onClose={closeTab}
          onOpenRun={() => onLeftModeChange("run")}
          onCommentSent={() => onLeftModeChange("chat")}
        />
      }
    />
  );
}

function RightStage(options: {
  sessionId: string;
  docs: FileTab[];
  activeId: string;
  activeDoc: FileTab | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onOpenRun: () => void;
  onCommentSent: () => void;
}) {
  const {
    sessionId,
    docs,
    activeId,
    activeDoc,
    onSelect,
    onClose,
    onOpenRun,
    onCommentSent
  } = options;
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-w-0 shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-muted/40 px-1">
        <button
          type="button"
          aria-pressed={activeId === PREVIEW_TAB_ID}
          onClick={() => onSelect(PREVIEW_TAB_ID)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-t-md px-2.5 py-1.5 text-xs",
            activeId === PREVIEW_TAB_ID
              ? "bg-background font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Globe className="size-3.5" />
          Preview
        </button>
        {docs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "inline-flex max-w-[12rem] items-center rounded-t-md",
              activeId === tab.id
                ? "bg-background text-foreground"
                : "text-muted-foreground"
            )}
          >
            <button
              type="button"
              aria-pressed={activeId === tab.id}
              title={tab.path}
              onClick={() => onSelect(tab.id)}
              className={cn(
                "min-w-0 truncate px-2 py-1.5 text-xs",
                activeId === tab.id && "font-medium"
              )}
            >
              {tab.kind === "diff" ? "Δ " : ""}
              {tabLabel(tab)}
            </button>
            <button
              type="button"
              aria-label={`Close ${tabLabel(tab)}`}
              onClick={() => onClose(tab.id)}
              className="mr-1 inline-flex size-5 items-center justify-center rounded-sm hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        <div className={cn("h-full", activeDoc && "hidden")}>
          <AppPreviewPane
            sessionId={sessionId}
            onOpenRun={onOpenRun}
            onCommentSent={onCommentSent}
          />
        </div>
        {activeDoc ? (
          <div className="absolute inset-0 bg-background">
            <FileTabPane sessionId={sessionId} tab={activeDoc} />
          </div>
        ) : null}
      </div>
      <BottomTerminal sessionId={sessionId} />
    </div>
  );
}
