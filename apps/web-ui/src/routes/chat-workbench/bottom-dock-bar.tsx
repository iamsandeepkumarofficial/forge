import { type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  SquareTerminal,
  Terminal,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CloseableDockMode, PreviewDockMode } from "./terminal-toggle.js";

export function DockBar(options: {
  open: boolean;
  mode: PreviewDockMode;
  extras: CloseableDockMode[];
  onSelect: (mode: PreviewDockMode) => void;
  onCloseExtra: (extra: CloseableDockMode) => void;
  onToggle: () => void;
}) {
  const { open, mode, extras, onSelect, onCloseExtra, onToggle } = options;
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
      {extras.includes("devtools") ? (
        <DockExtraTab
          label="DevTools"
          icon={<SquareTerminal className="size-3.5" />}
          active={open && mode === "devtools"}
          onSelect={() => onSelect("devtools")}
          onClose={() => onCloseExtra("devtools")}
        />
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

function DockExtraTab(options: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const { label, icon, active, onSelect, onClose } = options;
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md",
        active ? "bg-muted text-foreground" : "text-muted-foreground"
      )}
    >
      <button
        type="button"
        aria-pressed={active}
        onClick={onSelect}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 font-medium uppercase tracking-wide",
          !active && "hover:text-foreground"
        )}
      >
        {icon}
        {label}
      </button>
      <button
        type="button"
        aria-label={`Close ${label}`}
        title={`Close ${label}`}
        onClick={onClose}
        className="mr-0.5 inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3" />
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
