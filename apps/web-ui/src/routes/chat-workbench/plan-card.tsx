import { TaskLiveStream } from "./task-live-stream.js";
import { HumanOutputForm } from "./human-output-form.js";

export type PlanCardTaskStatus =
  "pending" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export type PlanCardPlanStatus =
  "planned" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export type PlanCardSchemaNode = {
  type?: string;
  properties?: Record<string, PlanCardSchemaNode>;
  required?: string[];
  items?: PlanCardSchemaNode;
  description?: string;
  enum?: Array<string | number | boolean | null>;
  additionalProperties?: boolean;
};

export type PlanCardTask = {
  id: string;
  description: string;
  status: PlanCardTaskStatus;
  dependencies: string[];
  error?: string;
  executor?: string;
  rationale?: string;
  isolation?: "inline" | "child";
  outputSchema?: PlanCardSchemaNode;
  streamTurnId?: string;
};

export type PlanCardSection = {
  title: string;
  body: string;
};

export type PlanCardModel = {
  goal: string;
  sections?: PlanCardSection[];
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

function asSchema(value: unknown): PlanCardSchemaNode | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as PlanCardSchemaNode;
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
      ...(typeof row.executor === "string" ? { executor: row.executor } : {}),
      ...(typeof row.rationale === "string" && row.rationale.trim()
        ? { rationale: row.rationale.trim() }
        : {}),
      ...(row.isolation === "child" || row.isolation === "inline"
        ? { isolation: row.isolation }
        : {}),
      ...(typeof row.streamTurnId === "string"
        ? { streamTurnId: row.streamTurnId }
        : {}),
      ...(asSchema(row.outputSchema)
        ? { outputSchema: asSchema(row.outputSchema) }
        : {})
    });
  }
  if (!goal && tasks.length === 0) return null;
  const queued =
    snapshot.queuedFollowUp && typeof snapshot.queuedFollowUp === "object"
      ? (snapshot.queuedFollowUp as { text?: string })
      : null;
  const sections: PlanCardSection[] = [];
  if (Array.isArray(snapshot.sections)) {
    for (const raw of snapshot.sections) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const title = typeof row.title === "string" ? row.title.trim() : "";
      const body = typeof row.body === "string" ? row.body.trim() : "";
      if (!title || !body) continue;
      sections.push({ title, body });
    }
  }
  return {
    goal: goal || "Plan",
    ...(sections.length ? { sections } : {}),
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

function PlanTaskRow(props: {
  task: PlanCardTask;
  index: number;
  sessionId?: string;
  onHumanAnswer?: (input: {
    taskId: string;
    decision: "approve" | "reject" | "skip";
    payload?: unknown;
  }) => void | Promise<void>;
}) {
  const { task, index, sessionId, onHumanAnswer } = props;
  return (
    <li className="flex items-start gap-2" data-task-status={task.status}>
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
          {task.isolation === "child" ? (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              parallel
            </span>
          ) : null}
          <span className={`text-xs ${statusClass(task.status)}`}>
            {STATUS_LABEL[task.status] ?? task.status}
          </span>
        </div>
        {task.rationale ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {task.rationale}
          </p>
        ) : null}
        {task.error ? (
          <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">
            {task.error}
          </p>
        ) : null}
        {sessionId && task.streamTurnId && task.status === "running" ? (
          <TaskLiveStream
            sessionId={sessionId}
            streamTurnId={task.streamTurnId}
            active
          />
        ) : null}
        {task.status === "waiting" &&
        task.executor === "human" &&
        onHumanAnswer ? (
          <HumanOutputForm
            task={task}
            onSubmit={(answer) =>
              onHumanAnswer({
                taskId: task.id,
                decision: answer.decision,
                ...(answer.payload !== undefined
                  ? { payload: answer.payload }
                  : {})
              })
            }
          />
        ) : null}
      </div>
    </li>
  );
}

function PlanCardBanners(props: {
  plan: PlanCardModel;
  canBuild: boolean;
  onBuild?: () => void | Promise<void>;
  onForceSend?: () => void;
}) {
  const { plan, canBuild, onBuild, onForceSend } = props;
  return (
    <>
      {plan.sections && plan.sections.length > 0 ? (
        <div className="mb-2 space-y-1 text-xs text-muted-foreground">
          {plan.sections.map((section) => (
            <p key={section.title}>
              <span className="font-medium text-foreground">
                {section.title}:
              </span>{" "}
              {section.body}
            </p>
          ))}
        </div>
      ) : null}
      {canBuild ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5">
          <span className="text-xs text-muted-foreground">
            Review the plan, then start execution.
          </span>
          <button
            type="button"
            className="shrink-0 rounded border border-foreground/20 bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-90"
            onClick={() => void onBuild?.()}
          >
            Build
          </button>
        </div>
      ) : null}
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
    </>
  );
}

export function PlanCard(props: {
  plan: PlanCardModel;
  sessionId?: string;
  onForceSend?: () => void;
  onBuild?: () => void | Promise<void>;
  onHumanAnswer?: (input: {
    taskId: string;
    decision: "approve" | "reject" | "skip";
    payload?: unknown;
  }) => void | Promise<void>;
}) {
  const { plan, sessionId, onForceSend, onBuild, onHumanAnswer } = props;
  const done = plan.tasks.filter((t) => t.status === "completed").length;
  const canBuild = plan.status === "planned" && Boolean(onBuild);
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
      <PlanCardBanners
        plan={plan}
        canBuild={canBuild}
        onBuild={onBuild}
        onForceSend={onForceSend}
      />
      <ol className="space-y-1.5">
        {plan.tasks.map((task, index) => (
          <PlanTaskRow
            key={task.id}
            task={task}
            index={index}
            sessionId={sessionId}
            onHumanAnswer={onHumanAnswer}
          />
        ))}
      </ol>
    </section>
  );
}
