import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  CircleHelp,
  FileText,
  GitCompareArrows,
  LogOut,
  MessageSquare,
  MoreVertical,
  Play
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { acquirePreviewOverlayLock } from "./preview-overlay-lock.js";
import type {
  LeftPaneMode,
  SandboxStatus,
  WorkbenchTurnStatus
} from "./types.js";

const MODES: {
  key: LeftPaneMode;
  label: string;
  icon: typeof FileText;
}[] = [
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "files", label: "Files", icon: FileText },
  { key: "changes", label: "Changes", icon: GitCompareArrows },
  { key: "run", label: "Run", icon: Play },
  { key: "help", label: "Help", icon: CircleHelp }
];

function ModeTabs(options: {
  leftMode: LeftPaneMode;
  onLeftMode: (mode: LeftPaneMode) => void;
}) {
  const { leftMode, onLeftMode } = options;
  return (
    <div className="relative z-10 flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5">
      {MODES.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          aria-pressed={leftMode === key}
          onClick={() => onLeftMode(key)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
            leftMode === key
              ? "bg-background font-medium text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function SessionHeaderActions(options: {
  actions?: ReactNode;
  onExit: () => void;
}) {
  const { actions, onExit } = options;
  return (
    <div className="relative z-10 ml-auto flex min-w-0 items-center justify-end gap-1.5 bg-background pl-2">
      <button
        type="button"
        aria-label="Leave session"
        title="Leave session"
        onClick={onExit}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-700"
      >
        <LogOut className="size-4" />
      </button>
      {actions ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Session actions"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {actions}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export function SessionHeader(options: {
  onBack: () => void;
  title: string;
  turnStatus: WorkbenchTurnStatus;
  sandboxStatus: SandboxStatus;
  leftMode: LeftPaneMode;
  onLeftMode: (mode: LeftPaneMode) => void;
  actions?: ReactNode;
}) {
  const { onBack, title, leftMode, onLeftMode, actions } = options;
  const [confirmExit, setConfirmExit] = useState(false);
  return (
    <div className="relative flex min-w-0 shrink-0 items-center gap-2 border-b px-3 py-1.5">
      <ModeTabs leftMode={leftMode} onLeftMode={onLeftMode} />
      <h1 className="pointer-events-none absolute inset-x-12 truncate text-center text-sm font-semibold">
        {title}
      </h1>
      <SessionHeaderActions
        actions={actions}
        onExit={() => setConfirmExit(true)}
      />
      {confirmExit ? (
        <ExitSessionDialog
          onStay={() => setConfirmExit(false)}
          onLeave={() => {
            setConfirmExit(false);
            onBack();
          }}
        />
      ) : null}
    </div>
  );
}

function ExitSessionDialog(options: {
  onStay: () => void;
  onLeave: () => void;
}) {
  const { onStay, onLeave } = options;
  useEffect(() => acquirePreviewOverlayLock(), []);
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Stay in session"
        className="absolute inset-0 bg-black/40"
        onClick={onStay}
      />
      <div
        role="dialog"
        aria-labelledby="leave-session-title"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-xl border bg-background p-4 shadow-xl"
      >
        <h2 id="leave-session-title" className="text-sm font-semibold">
          Leave this session?
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          You’ll return to the chat list. The sandbox keeps running.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onStay}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Leave
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
