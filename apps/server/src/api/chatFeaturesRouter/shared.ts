import { ActivityRepository } from "../../catalog/activityRepository.js";
import { ChatCommentRepository } from "../../catalog/chatCommentRepository.js";
import { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import { ProjectRepository } from "../../catalog/projectRepository.js";
import { ChatFeatureService } from "../../projects/chatFeatureService.js";

export const chatRepo = new ChatFeatureRepository();
export const projectRepo = new ProjectRepository();
export const commentRepo = new ChatCommentRepository();
export const activityRepo = new ActivityRepository();
export const chatFeatureService = new ChatFeatureService(chatRepo);

export const VALID_STATUSES = [
  "no_section",
  "planning",
  "development",
  "qa",
  "done"
];
export const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

export function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a ?? null) === (b ?? null);
  }
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

function formatHistoryValue(value: unknown): string {
  if (value === null || value === undefined) return "none";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return "updated";
  return String(value);
}

export async function writeHistory(options: {
  chatFeatureId: string;
  userId: string;
  field: string;
  from: unknown;
  to: unknown;
}): Promise<void> {
  const { chatFeatureId, userId, field, from, to } = options;
  const label =
    field === "dueDate"
      ? "Due date"
      : field.charAt(0).toUpperCase() + field.slice(1);
  await activityRepo.create({
    chatFeatureId,
    kind: "history",
    actorType: "builder",
    agentId: null,
    userId,
    summary: `${label} changed from ${formatHistoryValue(from)} to ${formatHistoryValue(to)}`,
    detail: { field, from: from ?? null, to: to ?? null }
  });
}
