import { ListTree, PanelRight } from "lucide-react";
import type { PlanCardModel } from "./plan-card.js";
import { PlanCard } from "./plan-card.js";
export function PlanChatSection(props: {
  plan: PlanCardModel;
  onOpenInPanel?: () => void;
  onForceSend?: () => void;
}) {
  const { plan, onOpenInPanel, onForceSend } = props;
  const done = plan.tasks.filter((t) => t.status === "completed").length;
  const active =
    plan.tasks.find((t) => t.status === "running" || t.status === "waiting") ??
    null;
  return (
    <section
      aria-label="Execution plan"
      className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm"
    >
      <header className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <ListTree className="size-3.5 shrink-0 text-muted-foreground" />
          <h2 className="font-medium text-foreground">Plan</h2>
          <span className="truncate text-xs text-muted-foreground">
            {plan.status}
            {plan.tasks.length > 0 ? ` · ${done}/${plan.tasks.length}` : ""}
          </span>
        </div>
        {onOpenInPanel ? (
          <button
            type="button"
            onClick={onOpenInPanel}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
          >
            <PanelRight className="size-3.5" />
            Open in panel
          </button>
        ) : null}
      </header>
      <p className="mb-1.5 line-clamp-2 text-muted-foreground">{plan.goal}</p>
      {active ? (
        <p className="mb-1.5 text-xs text-muted-foreground">
          Now: <span className="text-foreground">{active.description}</span>
        </p>
      ) : null}
      {plan.queuedFollowUp ? (
        <div className="mb-1.5 flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs">
          <span className="truncate text-muted-foreground">
            Queued: {plan.queuedFollowUp.text}
          </span>
          {onForceSend ? (
            <button
              type="button"
              className="shrink-0 rounded border px-2 py-0.5 hover:bg-muted"
              onClick={onForceSend}
            >
              Send now
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function PlanPanel(props: {
  plan: PlanCardModel | null;
  onForceSend?: () => void;
}) {
  if (!props.plan) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        No active plan for this session.
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto p-4">
      <PlanCard plan={props.plan} onForceSend={props.onForceSend} />
    </div>
  );
}
