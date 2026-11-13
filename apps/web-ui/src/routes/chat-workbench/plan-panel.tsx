import { ListTree, PanelRight } from "lucide-react";
import type { PlanCardModel } from "./plan-card.js";
import { PlanCard } from "./plan-card.js";
export function PlanChatSection(props: {
  plan: PlanCardModel;
  onOpenInPanel?: () => void;
  onForceSend?: () => void;
  onBuild?: () => void | Promise<void>;
}) {
  const { plan, onOpenInPanel, onForceSend, onBuild } = props;
  const done = plan.tasks.filter((t) => t.status === "completed").length;
  const active =
    plan.tasks.find((t) => t.status === "running" || t.status === "waiting") ??
    null;
  const canBuild = plan.status === "planned" && Boolean(onBuild);
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
        <div className="flex shrink-0 items-center gap-1">
          {canBuild ? (
            <button
              type="button"
              onClick={() => void onBuild?.()}
              className="inline-flex items-center rounded-md border border-foreground/20 bg-foreground px-2 py-1 text-xs font-medium text-background hover:opacity-90"
            >
              Build
            </button>
          ) : null}
          {onOpenInPanel ? (
            <button
              type="button"
              onClick={onOpenInPanel}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              <PanelRight className="size-3.5" />
              Open in panel
            </button>
          ) : null}
        </div>
      </header>
      <p className="mb-1.5 line-clamp-2 text-muted-foreground">{plan.goal}</p>
      {canBuild ? (
        <p className="mb-1.5 text-xs text-muted-foreground">
          Waiting for Build — plan will not run until you start it.
        </p>
      ) : null}
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
  sessionId?: string;
  onForceSend?: () => void;
  onBuild?: () => void | Promise<void>;
  onHumanAnswer?: (input: {
    taskId: string;
    decision: "approve" | "reject" | "skip";
    payload?: unknown;
  }) => void | Promise<void>;
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
      <PlanCard
        plan={props.plan}
        sessionId={props.sessionId}
        onForceSend={props.onForceSend}
        onBuild={props.onBuild}
        onHumanAnswer={props.onHumanAnswer}
      />
    </div>
  );
}
