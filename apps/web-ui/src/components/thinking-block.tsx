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
    <div className="rounded-md border border-border/70 bg-muted/20 text-xs text-muted-foreground">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/40"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span
          className={cn(
            "inline-block size-1.5 shrink-0 rounded-full bg-muted-foreground/70",
            streaming && "animate-pulse bg-primary"
          )}
        />
        <span className="font-medium tracking-wide uppercase">
          {streaming ? "Thinking" : "Thought"}
        </span>
        <span className="ml-auto text-[10px] opacity-70">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-border/60 px-2.5 py-2 whitespace-pre-wrap">
          {text}
          {streaming ? <span className="animate-pulse">▍</span> : null}
        </div>
      ) : null}
    </div>
  );
}
