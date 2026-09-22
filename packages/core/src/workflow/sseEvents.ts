export const PLAN_SSE_EVENTS = {
  planPublished: "plan_published",
  taskUpdated: "task_updated",
  planStatus: "plan_status",
  budgetUpdated: "budget_updated",
  followupQueued: "followup_queued",
  replan: "replan",
  mergeConflict: "merge_conflict"
} as const;

export type PlanSseEventType =
  (typeof PLAN_SSE_EVENTS)[keyof typeof PLAN_SSE_EVENTS];
