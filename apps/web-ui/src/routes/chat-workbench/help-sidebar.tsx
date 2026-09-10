import { HealthPanel } from "./health-panel.js";

export function HelpSidebar(options: {
  sessionId: string;
  onSwitchToChat?: () => void;
}) {
  const { sessionId, onSwitchToChat } = options;
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="border-b px-3 py-2">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
          Help
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Session health checklist. Fix sends a prompt to the agent (and cancels
          any in-flight run).
        </p>
      </div>
      <HealthPanel
        sessionId={sessionId}
        showFix
        onBeforeFix={onSwitchToChat}
        className="px-3 py-3"
      />
    </div>
  );
}
