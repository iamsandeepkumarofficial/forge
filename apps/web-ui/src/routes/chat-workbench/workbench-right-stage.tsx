import { Globe, X } from "lucide-react";
import { FileTabPane } from "./files-panels.js";
import { AppPreviewPane } from "./run-panels.js";
import { BottomTerminal } from "./bottom-terminal.js";
import { cn } from "@/lib/utils";
import type { FileTab } from "./types.js";
import { PREVIEW_TAB_ID, tabLabel } from "./right-tabs.js";

function RightDocTabs(options: {
  docs: FileTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const { docs, activeId, onSelect, onClose } = options;
  return (
    <>
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
    </>
  );
}

export function RightStage(options: {
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
        <RightDocTabs
          docs={docs}
          activeId={activeId}
          onSelect={onSelect}
          onClose={onClose}
        />
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
