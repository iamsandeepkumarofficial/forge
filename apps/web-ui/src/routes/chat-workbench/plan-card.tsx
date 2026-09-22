export type PlanCardTaskStatus =
  "pending" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export type PlanCardPlanStatus =
  "planned" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export type PlanCardTask = {
  id: string;
  description: string;
  status: PlanCardTaskStatus;
  dependencies: string[];
  error?: string;
  executor?: string;
};

export type PlanCardModel = {
  goal: string;
  status: PlanCardPlanStatus;
  version: number;
  tasks: PlanCardTask[];
  budgetStopReason?: string | null;
  queuedFollowUp?: { text: string } | null;
};

const STATUS_LABEL: Record<PlanCardTaskStatus, string> = {
  pending: "Pending",
  running: "Running",
  waiting: "Waiting",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled"
};

function statusClass(status: PlanCardTaskStatus): string {
  switch (status) {
    case "completed":
      return "text-emerald-700 dark:text-emerald-400";
    case "running":
      return "text-sky-700 dark:text-sky-400";
    case "failed":
      return "text-red-700 dark:text-red-400";
    case "waiting":
      return "text-amber-700 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

export function planCardFromSnapshot(
  snapshot: Record<string, unknown> | null | undefined
): PlanCardModel | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const goal = typeof snapshot.goal === "string" ? snapshot.goal.trim() : "";
  const status = (
    typeof snapshot.status === "string" ? snapshot.status : "planned"
  ) as PlanCardPlanStatus;
  const version = typeof snapshot.version === "number" ? snapshot.version : 1;
  const rawTasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  const tasks: PlanCardTask[] = [];
  for (const t of rawTasks) {
    if (!t || typeof t !== "object") continue;
    const row = t as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) continue;
    tasks.push({
      id,
      description: typeof row.description === "string" ? row.description : id,
      status: (typeof row.status === "string"
        ? row.status
        : "pending") as PlanCardTaskStatus,
      dependencies: Array.isArray(row.dependencies)
        ? row.dependencies.filter((d): d is string => typeof d === "string")
        : [],
      ...(typeof row.error === "string" ? { error: row.error } : {}),
      ...(typeof row.executor === "string" ? { executor: row.executor } : {})
    });
  }
  if (!goal && tasks.length === 0) return null;
  const queued =
    snapshot.queuedFollowUp && typeof snapshot.queuedFollowUp === "object"
      ? (snapshot.queuedFollowUp as { text?: string })
      : null;
  return {
    goal: goal || "Plan",
    status,
    version,
    tasks,
    budgetStopReason:
      typeof snapshot.budgetStopReason === "string"
        ? snapshot.budgetStopReason
        : null,
    queuedFollowUp:
      queued && typeof queued.text === "string" ? { text: queued.text } : null
  };
}

export function PlanCard(props: {
  plan: PlanCardModel;
  onForceSend?: () => void;
}) {
  const { plan, onForceSend } = props;
  const done = plan.tasks.filter((t) => t.status === "completed").length;
  return (
    <section
      aria-label="Execution plan"
      className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm"
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-medium text-foreground">Plan</h2>
        <span className="text-xs text-muted-foreground">
          {plan.status}
          {plan.tasks.length > 0 ? ` · ${done}/${plan.tasks.length}` : ""}
          {plan.version > 1 ? ` · v${plan.version}` : ""}
        </span>
      </header>
      <p className="mb-2 text-muted-foreground">{plan.goal}</p>
      {plan.budgetStopReason ? (
        <p className="mb-2 text-xs text-red-700 dark:text-red-400">
          Stopped: {plan.budgetStopReason} budget
        </p>
      ) : null}
      {plan.queuedFollowUp ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs">
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
      <ol className="space-y-1.5">
        {plan.tasks.map((task, index) => (
          <li
            key={task.id}
            className="flex items-start gap-2"
            data-task-status={task.status}
          >
            <span className="mt-0.5 w-5 shrink-0 text-xs text-muted-foreground">
              {index + 1}.
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-medium text-foreground">
                  {task.description}
                </span>
                {task.executor ? (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {task.executor}
                  </span>
                ) : null}
                <span className={`text-xs ${statusClass(task.status)}`}>
                  {STATUS_LABEL[task.status] ?? task.status}
                </span>
              </div>
              {task.error ? (
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">
                  {task.error}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
