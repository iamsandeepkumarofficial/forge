import {
  MAX_TASKS_PER_PLAN_VERSION,
  TASK_EXECUTORS,
  type TaskExecutor,
  type WorkflowPlanDraft,
  type WorkflowTaskDraft
} from "./types.js";

export type PlanValidationError = {
  code:
    | "empty_tasks"
    | "too_many_tasks"
    | "duplicate_id"
    | "missing_description"
    | "invalid_executor"
    | "missing_dependency"
    | "cycle";
  message: string;
  taskId?: string;
};

export type PlanValidationResult =
  | { ok: true; plan: WorkflowPlanDraft }
  | { ok: false; errors: PlanValidationError[] };

function isExecutor(value: unknown): value is TaskExecutor {
  return (
    typeof value === "string" &&
    (TASK_EXECUTORS as readonly string[]).includes(value)
  );
}

export function topoSort(tasks: WorkflowTaskDraft[]): string[] | null {
  const ids = new Set(tasks.map((t) => t.id));
  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const id of ids) {
    indegree.set(id, 0);
    children.set(id, []);
  }
  for (const task of tasks) {
    for (const dep of task.dependencies ?? []) {
      if (!ids.has(dep)) continue;
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
      children.get(dep)!.push(task.id);
    }
  }
  const queue = [...ids].filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const child of children.get(id) ?? []) {
      const next = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, next);
      if (next === 0) queue.push(child);
    }
  }
  return order.length === ids.size ? order : null;
}

export function readyTaskIds(
  tasks: Array<{ id: string; dependencies?: string[]; status: string }>,
  completed: Set<string>
): string[] {
  return tasks
    .filter((t) => t.status === "pending")
    .filter((t) => (t.dependencies ?? []).every((d) => completed.has(d)))
    .map((t) => t.id);
}

function parseTaskDrafts(
  rawTasks: unknown[],
  errors: PlanValidationError[]
): WorkflowTaskDraft[] {
  const tasks: WorkflowTaskDraft[] = [];
  const seen = new Set<string>();
  for (const raw of rawTasks) {
    if (!raw || typeof raw !== "object") continue;
    const id =
      typeof (raw as { id?: unknown }).id === "string"
        ? (raw as { id: string }).id.trim()
        : "";
    const description =
      typeof (raw as { description?: unknown }).description === "string"
        ? (raw as { description: string }).description.trim()
        : "";
    const executorRaw = (raw as { executor?: unknown }).executor;
    const depsRaw = (raw as { dependencies?: unknown }).dependencies;
    const dependencies = Array.isArray(depsRaw)
      ? depsRaw.filter(
          (d): d is string => typeof d === "string" && d.trim() !== ""
        )
      : [];
    if (!id) {
      errors.push({
        code: "duplicate_id",
        message: "Task id is required"
      });
      continue;
    }
    if (seen.has(id)) {
      errors.push({
        code: "duplicate_id",
        message: `Duplicate task id "${id}"`,
        taskId: id
      });
      continue;
    }
    seen.add(id);
    if (!description) {
      errors.push({
        code: "missing_description",
        message: `Task "${id}" needs a description`,
        taskId: id
      });
    }
    if (!isExecutor(executorRaw)) {
      errors.push({
        code: "invalid_executor",
        message: `Task "${id}" needs executor agent|tool|human`,
        taskId: id
      });
    }
    tasks.push({
      id,
      description: description || id,
      executor: isExecutor(executorRaw) ? executorRaw : "agent",
      dependencies,
      idempotent:
        typeof (raw as { idempotent?: unknown }).idempotent === "boolean"
          ? (raw as { idempotent: boolean }).idempotent
          : undefined,
      input: (raw as { input?: unknown }).input
    });
  }
  return tasks;
}

function pushGraphErrors(
  tasks: WorkflowTaskDraft[],
  errors: PlanValidationError[]
): void {
  const seen = new Set(tasks.map((t) => t.id));
  for (const task of tasks) {
    for (const dep of task.dependencies ?? []) {
      if (!seen.has(dep)) {
        errors.push({
          code: "missing_dependency",
          message: `Task "${task.id}" depends on missing "${dep}"`,
          taskId: task.id
        });
      }
    }
  }
  if (topoSort(tasks) === null && tasks.length > 0) {
    errors.push({
      code: "cycle",
      message: "Task dependencies contain a cycle"
    });
  }
}

export function validatePlanDraft(draft: unknown): PlanValidationResult {
  const errors: PlanValidationError[] = [];
  if (!draft || typeof draft !== "object") {
    return {
      ok: false,
      errors: [{ code: "empty_tasks", message: "Plan draft must be an object" }]
    };
  }
  const goal =
    typeof (draft as { goal?: unknown }).goal === "string"
      ? (draft as { goal: string }).goal.trim()
      : "";
  const rawTasks = (draft as { tasks?: unknown }).tasks;
  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    return {
      ok: false,
      errors: [
        {
          code: "empty_tasks",
          message: "Plan must include at least one task"
        }
      ]
    };
  }
  if (rawTasks.length > MAX_TASKS_PER_PLAN_VERSION) {
    errors.push({
      code: "too_many_tasks",
      message: `Plan may have at most ${MAX_TASKS_PER_PLAN_VERSION} tasks`
    });
  }
  const tasks = parseTaskDrafts(rawTasks, errors);
  pushGraphErrors(tasks, errors);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    plan: {
      goal: goal || "User goal",
      tasks
    }
  };
}
