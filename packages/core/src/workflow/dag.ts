import {
  MAX_TASKS_PER_PLAN_VERSION,
  TASK_EXECUTORS,
  TASK_ISOLATIONS,
  type InputMapping,
  type TaskExecutor,
  type TaskIsolation,
  type TaskSchema,
  type WorkflowPlanDraft,
  type WorkflowTaskDraft
} from "./types.js";
import { validateInputMappings } from "./schemas/check-compatibility.js";
import { validateTaskSchema } from "./schemas/validate-schema.js";
import { parsePlanSections, pushRootInputErrors } from "./planDraftParts.js";

export { parsePlanSections };

export type PlanValidationError = {
  code:
    | "empty_tasks"
    | "too_many_tasks"
    | "duplicate_id"
    | "invalid_id"
    | "missing_description"
    | "invalid_executor"
    | "missing_dependency"
    | "cycle"
    | "invalid_schema"
    | "invalid_mapping"
    | "invalid_root_input";
  message: string;
  taskId?: string;
};

export type PlanValidationResult =
  | { ok: true; plan: WorkflowPlanDraft }
  | { ok: false; errors: PlanValidationError[] };

const TASK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function isExecutor(value: unknown): value is TaskExecutor {
  return (
    typeof value === "string" &&
    (TASK_EXECUTORS as readonly string[]).includes(value)
  );
}

function parseIsolation(value: unknown): TaskIsolation | undefined {
  if (
    typeof value === "string" &&
    (TASK_ISOLATIONS as readonly string[]).includes(value)
  ) {
    return value as TaskIsolation;
  }
  return undefined;
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

function parseMappings(opts: {
  raw: unknown;
  taskId: string;
  errors: PlanValidationError[];
}): InputMapping[] {
  if (opts.raw === undefined) return [];
  if (!Array.isArray(opts.raw)) {
    opts.errors.push({
      code: "invalid_mapping",
      message: `Task "${opts.taskId}" inputMappings must be an array`,
      taskId: opts.taskId
    });
    return [];
  }
  const mappings: InputMapping[] = [];
  for (const item of opts.raw) {
    if (!item || typeof item !== "object") continue;
    const fromTask = (item as { fromTask?: unknown }).fromTask;
    if (typeof fromTask !== "string" || !fromTask.trim()) {
      opts.errors.push({
        code: "invalid_mapping",
        message: `Task "${opts.taskId}" mapping needs fromTask`,
        taskId: opts.taskId
      });
      continue;
    }
    const outputPath = (item as { outputPath?: unknown }).outputPath;
    const targetPath = (item as { targetPath?: unknown }).targetPath;
    mappings.push({
      fromTask: fromTask.trim(),
      ...(typeof outputPath === "string" ? { outputPath } : {}),
      ...(typeof targetPath === "string" ? { targetPath } : {})
    });
  }
  return mappings;
}

function parseSchemaField(opts: {
  raw: unknown;
  taskId: string;
  field: "inputSchema" | "outputSchema";
  errors: PlanValidationError[];
}): TaskSchema | null {
  if (opts.raw === undefined) {
    opts.errors.push({
      code: "invalid_schema",
      message: `Task "${opts.taskId}" missing ${opts.field}`,
      taskId: opts.taskId
    });
    return null;
  }
  const result = validateTaskSchema(opts.raw);
  if (!result.ok) {
    for (const err of result.errors) {
      opts.errors.push({
        code: "invalid_schema",
        message: `Task "${opts.taskId}" ${opts.field}: ${err.message}`,
        taskId: opts.taskId
      });
    }
    return null;
  }
  return result.schema;
}

function taskIdentity(
  raw: Record<string, unknown>,
  errors: PlanValidationError[]
): {
  id: string;
  description: string;
  executorRaw: unknown;
  dependencies: string[];
} | null {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const description =
    typeof raw.description === "string" ? raw.description.trim() : "";
  const depsRaw = raw.dependencies;
  const dependencies = Array.isArray(depsRaw)
    ? depsRaw.filter(
        (d): d is string => typeof d === "string" && d.trim() !== ""
      )
    : [];
  if (!id) {
    errors.push({ code: "duplicate_id", message: "Task id is required" });
    return null;
  }
  if (!TASK_ID_RE.test(id)) {
    errors.push({
      code: "invalid_id",
      message: `Task id "${id}" must be letters, numbers, "_" or "-"`,
      taskId: id
    });
    return null;
  }
  return {
    id,
    description,
    executorRaw: raw.executor,
    dependencies
  };
}

function pushAcceptedTask(opts: {
  raw: Record<string, unknown>;
  id: string;
  description: string;
  executorRaw: unknown;
  dependencies: string[];
  inputSchema: TaskSchema;
  outputSchema: TaskSchema;
  inputMappings: InputMapping[];
  tasks: WorkflowTaskDraft[];
}): void {
  const rationaleRaw = opts.raw.rationale;
  const rationale =
    typeof rationaleRaw === "string" && rationaleRaw.trim()
      ? rationaleRaw.trim()
      : undefined;
  const isolation = parseIsolation(opts.raw.isolation);
  opts.tasks.push({
    id: opts.id,
    description: opts.description || opts.id,
    executor: isExecutor(opts.executorRaw) ? opts.executorRaw : "agent",
    dependencies: opts.dependencies,
    idempotent:
      typeof opts.raw.idempotent === "boolean"
        ? opts.raw.idempotent
        : undefined,
    ...(isolation ? { isolation } : {}),
    ...(rationale ? { rationale } : {}),
    input: opts.raw.input,
    inputSchema: opts.inputSchema,
    outputSchema: opts.outputSchema,
    ...(opts.inputMappings.length ? { inputMappings: opts.inputMappings } : {})
  });
}

function appendTaskDraft(opts: {
  raw: Record<string, unknown>;
  seen: Set<string>;
  errors: PlanValidationError[];
  tasks: WorkflowTaskDraft[];
}): void {
  const identity = taskIdentity(opts.raw, opts.errors);
  if (!identity) return;
  const { id, description, executorRaw, dependencies } = identity;
  if (opts.seen.has(id)) {
    opts.errors.push({
      code: "duplicate_id",
      message: `Duplicate task id "${id}"`,
      taskId: id
    });
    return;
  }
  opts.seen.add(id);
  if (!description) {
    opts.errors.push({
      code: "missing_description",
      message: `Task "${id}" needs a description`,
      taskId: id
    });
  }
  if (!isExecutor(executorRaw)) {
    opts.errors.push({
      code: "invalid_executor",
      message: `Task "${id}" needs executor agent|tool|human`,
      taskId: id
    });
  }
  const inputSchema = parseSchemaField({
    raw: opts.raw.inputSchema,
    taskId: id,
    field: "inputSchema",
    errors: opts.errors
  });
  const outputSchema = parseSchemaField({
    raw: opts.raw.outputSchema,
    taskId: id,
    field: "outputSchema",
    errors: opts.errors
  });
  const inputMappings = parseMappings({
    raw: opts.raw.inputMappings,
    taskId: id,
    errors: opts.errors
  });
  for (const err of validateInputMappings({
    taskId: id,
    dependencies,
    mappings: inputMappings
  })) {
    opts.errors.push({
      code: "invalid_mapping",
      message: err.message,
      taskId: id
    });
  }
  if (!inputSchema || !outputSchema) return;
  pushAcceptedTask({
    raw: opts.raw,
    id,
    description,
    executorRaw,
    dependencies,
    inputSchema,
    outputSchema,
    inputMappings,
    tasks: opts.tasks
  });
}

function parseTaskDrafts(
  rawTasks: unknown[],
  errors: PlanValidationError[]
): WorkflowTaskDraft[] {
  const tasks: WorkflowTaskDraft[] = [];
  const seen = new Set<string>();
  for (const raw of rawTasks) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    appendTaskDraft({
      raw: raw as Record<string, unknown>,
      seen,
      errors,
      tasks
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
  pushRootInputErrors(tasks, errors);
  if (errors.length) return { ok: false, errors };
  const sections = parsePlanSections(
    (draft as { sections?: unknown }).sections
  );
  return {
    ok: true,
    plan: {
      goal: goal || "User goal",
      ...(sections ? { sections } : {}),
      tasks
    }
  };
}
