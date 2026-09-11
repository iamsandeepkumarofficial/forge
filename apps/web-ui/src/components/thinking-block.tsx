import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils.js";

export function ThinkingBlock(options: {
  text: string;
  defaultOpen?: boolean;
  streaming?: boolean;
}) {
  const { text, streaming } = options;
  const [open, setOpen] = useState(Boolean(options.defaultOpen));
  if (!text.trim()) return null;
  return (
    <div className="group/think text-xs text-muted-foreground">
      <button
        type="button"
        className="inline-flex max-w-full items-center gap-1 py-0.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={cn("truncate font-medium", streaming && "italic")}>
          {streaming ? "Thinking…" : "Thought briefly"}
        </span>
        <ChevronRight
          className={cn(
            "size-3 shrink-0 opacity-0 transition-transform group-hover/think:opacity-100",
            open && "rotate-90 opacity-100"
          )}
        />
      </button>
      {open ? (
        <div className="mt-0.5 mb-1 pl-3 whitespace-pre-wrap">
          {text}
          {streaming ? <span className="animate-pulse">▍</span> : null}
        </div>
      ) : null}
    </div>
  );
}
