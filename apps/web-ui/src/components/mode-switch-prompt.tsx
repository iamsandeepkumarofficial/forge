import type { ComposerAgentMode } from "./chat-composer-shared.js";
import { AGENT_MODES } from "./chat-composer-shared.js";

export function ModeSwitchPrompt(options: {
  target: ComposerAgentMode;
  remainingSeconds: number;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const { target, remainingSeconds, onConfirm, onDismiss } = options;
  const label = AGENT_MODES.find((mode) => mode.id === target)?.label ?? target;
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-xs"
      role="status"
      aria-live="polite"
      data-testid="mode-switch-prompt"
    >
      <span className="text-muted-foreground">
        Agent wants to switch to{" "}
        <span className="font-medium text-foreground">{label}</span>
        <span aria-hidden="true"> · </span>
        <span data-testid="mode-switch-countdown">{remainingSeconds}s</span>
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md px-2 py-1 text-muted-foreground hover:bg-background hover:text-foreground"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-foreground px-2.5 py-1 font-medium text-background"
        >
          Switch to {label}
        </button>
      </div>
    </div>
  );
}
