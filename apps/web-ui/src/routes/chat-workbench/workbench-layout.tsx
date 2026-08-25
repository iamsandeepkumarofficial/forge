import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode
} from "react";
import { ChatPane } from "./chat-pane.js";
import { ChangesTab, FileTabPane, FilesTab } from "./files-panels.js";
import { AppPreviewPane } from "./run-panels.js";
import { RunSidebar } from "./run-sidebar.js";
import { BottomTerminal } from "./bottom-terminal.js";
import { SPLIT_KEY } from "./storage.js";
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

function TabBar<T extends string>(options: {
  tabs: [T, string][];
  active: T;
  onChange: (t: T) => void;
}) {
  const { tabs, active, onChange } = options;
  return (
    <div className="flex shrink-0 border-b bg-muted">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 text-xs ${active === key ? "font-semibold border-b-2 border-primary -mb-px" : "text-muted-foreground"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ResizableSplit(options: { left: ReactNode; right: ReactNode }) {
  const { left, right } = options;
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
      <div style={{ width: `${leftPct}%` }} className="min-w-0 border-r">
        {left}
      </div>
      <div
        onPointerDown={start}
        className="w-1 shrink-0 cursor-col-resize bg-muted hover:bg-primary"
        title="Drag to resize"
      />
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
}) {
  const o = options;
  return (
    <div className="flex h-full flex-col">
      <TabBar
        tabs={[
          ["chat", "Chat"],
          ["files", "Files"],
          ["changes", "Changes"],
          ["run", "Run"]
        ]}
        active={o.leftTab}
        onChange={o.setLeftTab}
      />
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
  return (
    <ResizableSplit
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
