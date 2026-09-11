import type { ReactNode } from "react";
import { X } from "lucide-react";
import { askUserDisplayPrompt } from "../lib/ask-user.js";
import { Button } from "@/components/ui/button";

const SHELL =
  "mx-auto w-full max-w-lg rounded-lg border border-border bg-card text-xs shadow-sm";

function PromptParagraphs(options: { prompt: string }) {
  const display = askUserDisplayPrompt(options.prompt);
  const blocks = display
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (blocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 text-muted-foreground">
      {blocks.map((block, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {block}
        </p>
      ))}
    </div>
  );
}

export function AskUserChrome(options: {
  prompt: string;
  submitting?: boolean;
  onSkip: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const { prompt, submitting, onSkip, onClose, children } = options;
  return (
    <div
      className={SHELL}
      role="group"
      aria-label="Agent question"
      data-testid="ask-user-prompt"
    >
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={submitting}
          aria-label="Skip"
          onClick={onSkip}
        >
          Skip
        </Button>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={submitting}
          aria-label="Close"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <PromptParagraphs prompt={prompt} />
      {children}
    </div>
  );
}
