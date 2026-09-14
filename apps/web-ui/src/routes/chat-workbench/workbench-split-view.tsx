import { type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useResizableSplitDrag } from "./use-resizable-split-drag.js";

export function LeftPaneRail(options: {
  modeIcon: LucideIcon;
  onToggle: () => void;
}) {
  const { modeIcon: ModeIcon, onToggle } = options;
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

export function ResizableSplit(options: {
  left: ReactNode;
  right: ReactNode;
  leftCollapsed: boolean;
  leftRailIcon: LucideIcon;
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
    leftRailIcon,
    leftPct,
    onDragStart,
    onLeftPct,
    onCollapse,
    onExpand
  } = options;
  const { containerRef, start, expand } = useResizableSplitDrag({
    leftPct,
    onDragStart,
    onLeftPct,
    onCollapse,
    onExpand
  });
  return (
    <div ref={containerRef} className="flex h-full min-h-0">
      {leftCollapsed ? (
        <div className="w-12 shrink-0">
          <LeftPaneRail modeIcon={leftRailIcon} onToggle={expand} />
        </div>
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
