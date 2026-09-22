import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
  ListTree,
  X
} from "lucide-react";
import type {
  PlanCardModel,
  PlanCardTask,
  PlanCardTaskStatus
} from "./plan-card.js";

function countLabel(plan: PlanCardModel): string {
  const done = plan.tasks.filter((t) => t.status === "completed").length;
  const total = plan.tasks.length;
  const active = plan.tasks.find(
    (t) => t.status === "running" || t.status === "waiting"
  );
  if (active) {
    return `${done}/${total} tasks · ${active.description}`;
  }
  if (plan.status === "completed") {
    return `${done}/${total} tasks complete`;
  }
  if (plan.status === "failed") {
    return `${done}/${total} tasks · failed`;
  }
  return total === 1 ? "1 task" : `${done}/${total} tasks`;
}

function TaskStatusIcon({ status }: { status: PlanCardTaskStatus }) {
  switch (status) {
    case "completed":
      return (
        <Check className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
      );
    case "running":
      return (
        <Loader2 className="size-3 shrink-0 animate-spin text-sky-600 dark:text-sky-400" />
      );
    case "failed":
      return <X className="size-3 shrink-0 text-red-600 dark:text-red-400" />;
    case "waiting":
      return (
        <Circle className="size-3 shrink-0 fill-amber-500/30 text-amber-600 dark:text-amber-400" />
      );
    case "cancelled":
      return <X className="size-3 shrink-0 text-muted-foreground" />;
    default:
      return <Circle className="size-3 shrink-0 text-muted-foreground" />;
  }
}

function PlanTaskRow({ task }: { task: PlanCardTask }) {
  return (
    <li
      className="flex items-start gap-1.5 rounded px-1.5 py-1 hover:bg-muted"
      data-task-status={task.status}
    >
      <span className="mt-0.5">
        <TaskStatusIcon status={task.status} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.7rem] font-medium text-foreground">
        {task.description}
      </span>
      <span className="shrink-0 text-[0.65rem] capitalize text-muted-foreground">
        {task.status}
      </span>
    </li>
  );
}

export function PlanTasksBar(props: {
  plan: PlanCardModel;
  onOpenPlan?: () => void;
}) {
  const { plan, onOpenPlan } = props;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (plan.tasks.length === 0) {
      void Promise.resolve().then(() => {
        setExpanded(false);
      });
    }
  }, [plan.tasks.length]);

  if (plan.tasks.length === 0) return null;

  return (
    <div
      data-testid="plan-tasks-bar"
      className="rounded-t-lg border border-b-0 border-border bg-background px-2 py-1.5"
    >
      <div className="flex w-full items-center gap-1.5">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[0.7rem] font-medium text-foreground/80 hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <ListTree className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{countLabel(plan)}</span>
        </button>
        {onOpenPlan ? (
          <button
            type="button"
            onClick={onOpenPlan}
            className="shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Panel
          </button>
        ) : null}
      </div>
      {expanded ? (
        <ol className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">
          {plan.tasks.map((task) => (
            <PlanTaskRow key={task.id} task={task} />
          ))}
        </ol>
      ) : null}
    </div>
  );
}
