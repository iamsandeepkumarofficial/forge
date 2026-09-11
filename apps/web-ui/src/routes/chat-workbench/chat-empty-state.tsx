import { HealthIssuesBanner } from "./health-panel.js";

export const CHAT_STARTERS: { label: string; prompt: string }[] = [
  {
    label: "Explain this workspace",
    prompt:
      "Explain this workspace: what it is, how it is structured, and how to run it."
  },
  {
    label: "Fix setup blockers",
    prompt:
      "Analyze this workspace and fix setup blockers so the app can run and preview."
  },
  {
    label: "Add a feature",
    prompt:
      "Help me add a new feature. First ask what I want, then implement it."
  }
];

export function TurnActivity({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyChat(options: {
  onPickStarter?: (prompt: string) => void;
  sessionId?: string;
  onOpenHelp?: () => void;
}) {
  const { onPickStarter, sessionId, onOpenHelp } = options;
  return (
    <div className="flex flex-col items-center gap-4 px-2 pt-8 text-center">
      <div>
        <p className="text-sm font-medium">What should we work on?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The agent edits this session’s sandbox. Preview appears when an app is
          running.
        </p>
      </div>
      {sessionId ? (
        <HealthIssuesBanner sessionId={sessionId} onOpenHelp={onOpenHelp} />
      ) : null}
      {onPickStarter ? (
        <div className="flex w-full max-w-sm flex-col gap-2">
          {CHAT_STARTERS.map((starter) => (
            <button
              key={starter.label}
              type="button"
              onClick={() => onPickStarter(starter.prompt)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
            >
              {starter.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
