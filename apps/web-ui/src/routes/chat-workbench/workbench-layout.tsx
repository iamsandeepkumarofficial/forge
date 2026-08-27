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
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Play
} from "lucide-react";
import { ChatPane } from "./chat-pane.js";
import { ChangesTab, FileTabPane, FilesTab } from "./files-panels.js";
import { AppPreviewPane } from "./run-panels.js";
import { RunSidebar } from "./run-sidebar.js";
import { BottomTerminal } from "./bottom-terminal.js";
import { SPLIT_KEY } from "./storage.js";
import { useCollapsibleSidebar } from "../../hooks/use-collapsible-sidebar.js";
import { cn } from "@/lib/utils";
import type { FileTab, LeftTab } from "./types.js";

const N_100 = 100;
const N_20 = 20;
const N_38 = 38;
const N_70 = 70;

function basename(p: string): string {
  return p.split("/").filter(Boolean).pop() ?? p;
}

function RightTabButton(options: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const { active, onClick, children } = options;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 border-r px-3 py-1.5 text-xs ${active ? "border-b-2 border-b-primary bg-background font-semibold" : "text-muted-foreground"}`}
    >
      {children}
    </button>
  );
}

const LEFT_TABS: {
  key: LeftTab;
  label: string;
  icon: typeof MessageSquare;
}[] = [
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "files", label: "Files", icon: FileText },
  { key: "changes", label: "Changes", icon: GitCompareArrows },
  { key: "run", label: "Run", icon: Play }
];

const WORKBENCH_LEFT_KEY = "forge:workbench-left-collapsed";

function TabBar(options: {
  active: LeftTab;
  collapsed: boolean;
  onChange: (t: LeftTab) => void;
  onToggleCollapse: () => void;
}) {
  const { active, collapsed, onChange, onToggleCollapse } = options;
  if (collapsed) {
    return (
      <div className="flex h-full shrink-0 flex-col items-center gap-1 border-r bg-muted py-2">
        {LEFT_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-label={label}
            title={label}
            onClick={() => onChange(key)}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-md",
              active === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
        <div className="mt-auto">
          <button
            type="button"
            aria-label="Expand panel"
            title="Expand panel"
            onClick={onToggleCollapse}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-center border-b bg-muted">
      {LEFT_TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          onClick={() => onChange(key)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs",
            active === key
              ? "-mb-px border-b-2 border-primary font-semibold"
              : "text-muted-foreground"
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
      <div className="ml-auto pr-1">
        <button
          type="button"
          aria-label="Collapse panel"
          title="Collapse panel"
          onClick={onToggleCollapse}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <PanelLeftClose className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function ResizableSplit(options: {
  left: ReactNode;
  right: ReactNode;
  leftCollapsed: boolean;
  leftRail?: ReactNode;
}) {
  const { left, right, leftCollapsed, leftRail } = options;
  const [leftPct, setLeftPct] = useState<number>(() => {
    const v = Number(localStorage.getItem(SPLIT_KEY));
    return Number.isFinite(v) && v >= N_20 && v <= N_70 ? v : N_38;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const leftPctRef = useRef(leftPct);
  useEffect(() => {
    leftPctRef.current = leftPct;
  }, [leftPct]);
  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * N_100;
    setLeftPct(Math.min(N_70, Math.max(N_20, pct)));
  }, []);
  const start = () => {
    dragging.current = true;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener(
      "pointerup",
      () => {
        dragging.current = false;
        try {
          localStorage.setItem(
            SPLIT_KEY,
            String(Math.round(leftPctRef.current))
          );
        } catch {
          void 0;
        }
        window.removeEventListener("pointermove", onPointerMove);
      },
      { once: true }
    );
  };
  return (
    <div ref={containerRef} className="flex h-full min-h-0">
      {leftCollapsed ? (
        <div className="w-12 shrink-0">{leftRail}</div>
      ) : (
        <>
          <div style={{ width: `${leftPct}%` }} className="min-w-0 border-r">
            {left}
          </div>
          <div
            onPointerDown={start}
            className="w-1 shrink-0 cursor-col-resize bg-muted hover:bg-primary"
            title="Drag to resize"
          />
        </>
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
  initialPrompt?: string;
  leftTab: LeftTab;
  setLeftTab: (t: LeftTab) => void;
  openFile: (path: string) => void;
  openDiff: (repo: string, path: string) => void;
  setRepo: (repo: string) => void;
  onShowPreview: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectTab: (t: LeftTab) => void;
}) {
  const o = options;
  return (
    <div className="flex h-full flex-col">
      <TabBar
        active={o.leftTab}
        collapsed={o.collapsed}
        onChange={o.onSelectTab}
        onToggleCollapse={o.onToggleCollapse}
      />
      {!o.collapsed && (
        <div className="min-h-0 flex-1">
          <div className={o.leftTab === "chat" ? "h-full" : "hidden"}>
            <ChatPane
              sessionId={o.sessionId}
              projectId={o.projectId}
              chatId={o.chatId}
              sessionKind={o.sessionKind}
              initialPrompt={o.initialPrompt}
            />
          </div>
          <div className={o.leftTab === "files" ? "h-full" : "hidden"}>
            <FilesTab sessionId={o.sessionId} onOpen={o.openFile} />
          </div>
          <div className={o.leftTab === "changes" ? "h-full" : "hidden"}>
            <ChangesTab
              sessionId={o.sessionId}
              onRepo={o.setRepo}
              onOpen={o.openDiff}
            />
          </div>
          <div className={o.leftTab === "run" ? "h-full" : "hidden"}>
            <RunSidebar sessionId={o.sessionId} onShowPreview={o.onShowPreview} />
          </div>
        </div>
      )}
    </div>
  );
}

function WorkbenchRight(options: {
  sessionId: string;
  fileTabs: FileTab[];
  activeRight: string;
  setActiveRight: (id: string) => void;
  closeTab: (id: string) => void;
  activeFileTab: FileTab | undefined;
}) {
  const {
    sessionId,
    fileTabs,
    activeRight,
    setActiveRight,
    closeTab,
    activeFileTab
  } = options;
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center overflow-x-auto border-b bg-muted">
        <RightTabButton
          active={activeRight === "preview"}
          onClick={() => setActiveRight("preview")}
        >
          Preview
        </RightTabButton>
        {fileTabs.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-1 border-r pr-1 ${activeRight === t.id ? "border-b-2 border-b-primary bg-background" : ""}`}
          >
            <button
              type="button"
              onClick={() => setActiveRight(t.id)}
              className={`max-w-[10rem] truncate py-1.5 pl-3 text-xs ${activeRight === t.id ? "font-semibold" : "text-muted-foreground"}`}
              title={t.path}
            >
              {t.kind === "diff" ? "⇄ " : ""}
              {basename(t.path)}
            </button>
            <button
              type="button"
              onClick={() => closeTab(t.id)}
              className="rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Close"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <div className={activeRight === "preview" ? "h-full" : "hidden"}>
          <AppPreviewPane sessionId={sessionId} />
        </div>
        {activeFileTab && (
          <FileTabPane
            key={activeFileTab.id}
            sessionId={sessionId}
            tab={activeFileTab}
          />
        )}
      </div>
      <BottomTerminal sessionId={sessionId} />
    </div>
  );
}

export function Workbench(options: {
  sessionId: string;
  projectId: string;
  chatId: string;
  sessionKind: "ticket" | "workbench";
  initialPrompt?: string;
}) {
  const { sessionId, projectId, chatId, sessionKind, initialPrompt } = options;
  const { collapsed, toggle, setCollapsed } =
    useCollapsibleSidebar(WORKBENCH_LEFT_KEY);
  const [leftTab, setLeftTab] = useState<LeftTab>("chat");
  const [, setRepo] = useState<string>("");
  const [fileTabs, setFileTabs] = useState<FileTab[]>([]);
  const [activeRight, setActiveRight] = useState<string>("preview");
  const openTab = useCallback((tab: FileTab) => {
    setFileTabs((prev) =>
      prev.some((t) => t.id === tab.id) ? prev : [...prev, tab]
    );
    setActiveRight(tab.id);
  }, []);
  const openFile = useCallback(
    (path: string) => openTab({ id: `file:${path}`, kind: "file", path }),
    [openTab]
  );
  const openDiff = useCallback(
    (r: string, path: string) =>
      openTab({ id: `diff:${r}:${path}`, kind: "diff", repo: r, path }),
    [openTab]
  );
  const closeTab = (id: string) => {
    setFileTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveRight((cur) => (cur === id ? "preview" : cur));
  };
  const activeFileTab = fileTabs.find((t) => t.id === activeRight);
  const selectLeftTab = (tab: LeftTab) => {
    setLeftTab(tab);
    if (collapsed) setCollapsed(false);
  };
  const leftRail = (
    <TabBar
      active={leftTab}
      collapsed
      onChange={selectLeftTab}
      onToggleCollapse={toggle}
    />
  );
  return (
    <ResizableSplit
      leftCollapsed={collapsed}
      leftRail={leftRail}
      left={
        <WorkbenchLeft
          sessionId={sessionId}
          projectId={projectId}
          chatId={chatId}
          sessionKind={sessionKind}
          initialPrompt={initialPrompt}
          leftTab={leftTab}
          setLeftTab={setLeftTab}
          openFile={openFile}
          openDiff={openDiff}
          setRepo={setRepo}
          onShowPreview={() => setActiveRight("preview")}
          collapsed={collapsed}
          onToggleCollapse={toggle}
          onSelectTab={selectLeftTab}
        />
      }
      right={
        <WorkbenchRight
          sessionId={sessionId}
          fileTabs={fileTabs}
          activeRight={activeRight}
          setActiveRight={setActiveRight}
          closeTab={closeTab}
          activeFileTab={activeFileTab}
        />
      }
    />
  );
}
