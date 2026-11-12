import {
  MAX_PLAN_SECTIONS,
  type PlanSection,
  type WorkflowTaskDraft
} from "./types.js";
import { validateTaskInput } from "./schemas/validate-input.js";
import type { PlanValidationError } from "./dag.js";

export function parsePlanSections(raw: unknown): PlanSection[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const sections: PlanSection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const title =
      typeof (item as { title?: unknown }).title === "string"
        ? (item as { title: string }).title.trim()
        : "";
    const body =
      typeof (item as { body?: unknown }).body === "string"
        ? (item as { body: string }).body.trim()
        : "";
    if (!title || !body) continue;
    sections.push({ title, body });
    if (sections.length >= MAX_PLAN_SECTIONS) break;
  }
  return sections.length ? sections : undefined;
}

export function pushRootInputErrors(
  tasks: WorkflowTaskDraft[],
  errors: PlanValidationError[]
): void {
  for (const task of tasks) {
    if ((task.dependencies ?? []).length > 0) {
      continue;
    }
    const required = task.inputSchema.required ?? [];
    if (required.length === 0) {
      continue;
    }
    const checked = validateTaskInput(task.inputSchema, task.input ?? {});
    if (!checked.ok) {
      errors.push({
        code: "invalid_root_input",
        message: `Task "${task.id}" is a root task whose inputSchema requires [${required.join(", ")}] but task.input does not satisfy it. Set task.input with those values, or use an empty inputSchema and put parameters in the description.`,
        taskId: task.id
      });
    }
  }
}
