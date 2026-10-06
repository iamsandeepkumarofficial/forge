import { shouldRetryTask, type TaskStatus } from "@forge/core";
import type { TaskState } from "./agentWorkflowModel.js";

export type TaskBuckets = {
  completed: Set<string>;
  failed: TaskState[];
  waiting: TaskState[];
  pending: TaskState[];
};

export function collectTaskBuckets(tasks: TaskState[]): TaskBuckets {
  return {
    completed: new Set(
      tasks.filter((t) => t.status === "completed").map((t) => t.id)
    ),
    failed: tasks.filter((t) => t.status === "failed"),
    waiting: tasks.filter((t) => t.status === "waiting"),
    pending: tasks.filter((t) => t.status === "pending")
  };
}

export function applyAnswerToTasks(opts: {
  tasks: TaskState[];
  taskId?: string;
}): TaskState[] {
  return opts.tasks.filter((t) => {
    if (t.status !== "waiting") {
      return false;
    }
    return !opts.taskId || t.id === opts.taskId;
  });
}

export function retryableFailedTasks(tasks: TaskState[]): TaskState[] {
  return tasks.filter((t) => {
    const decision = shouldRetryTask({
      idempotent: t.idempotent,
      attemptCount: t.attemptCount
    });
    return decision.action === "retry";
  });
}

export function keepCompletedOnReplan(opts: {
  next: TaskState[];
  completedIds: Set<string>;
}): TaskState[] {
  return opts.next.map((t) =>
    opts.completedIds.has(t.id)
      ? {
          ...t,
          status: "completed" as TaskStatus,
          attemptCount: 0
        }
      : t
  );
}

export function formatPlanMarkdown(opts: {
  goal: string;
  tasks: TaskState[];
}): string {
  const items = opts.tasks.map((t, i) => {
    const deps = t.dependencies.length
      ? ` _(depends on: ${t.dependencies.join(", ")})_`
      : "";
    return `${i + 1}. **${t.id}** (${t.executor}) — ${t.description}${deps}`;
  });
  return ["## Plan", "", `**Goal:** ${opts.goal}`, "", ...items].join("\n");
}

export function planTurnSummary(opts: {
  status: string;
  taskCount: number;
}): string {
  if (opts.status === "completed") {
    return `Plan completed (${opts.taskCount} tasks).`;
  }
  return `Plan ${opts.status}.`;
}

export function resultStatusForPlan(
  planStatus: string
): "completed" | "failed" | "cancelled" {
  if (planStatus === "failed") {
    return "failed";
  }
  if (planStatus === "cancelled") {
    return "cancelled";
  }
  return "completed";
}

export function tasksForPersist(tasks: TaskState[]) {
  return tasks.map((t) => ({
    id: t.id,
    description: t.description,
    executor: t.executor,
    dependencies: t.dependencies,
    status: t.status,
    idempotent: t.idempotent,
    ...(t.input !== undefined ? { input: t.input } : {})
  }));
}
