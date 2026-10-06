import { useCallback, useEffect, useState } from "react";
import {
  planCardFromSnapshot,
  type PlanCardModel,
  type PlanCardTaskStatus
} from "./plan-card.js";

const PLAN_EVENTS = {
  planPublished: "plan_published",
  taskUpdated: "task_updated",
  planStatus: "plan_status",
  replan: "replan"
} as const;

function taskPatchFromPayload(
  payload: Record<string, unknown>
): { id: string; status?: string; error?: string } | null {
  const nested =
    payload.task && typeof payload.task === "object"
      ? (payload.task as Record<string, unknown>)
      : null;
  const id =
    (typeof nested?.id === "string" && nested.id) ||
    (typeof payload.taskId === "string" && payload.taskId) ||
    "";
  if (!id) return null;
  const status =
    (typeof nested?.status === "string" && nested.status) ||
    (typeof payload.status === "string" && payload.status) ||
    undefined;
  const error =
    (typeof nested?.error === "string" && nested.error) ||
    (typeof payload.error === "string" && payload.error) ||
    undefined;
  return { id, status, error };
}

function planFromPublishedPayload(
  payload: Record<string, unknown>
): PlanCardModel | null {
  if (payload.plan && typeof payload.plan === "object") {
    return planCardFromSnapshot(payload.plan as Record<string, unknown>);
  }
  if (typeof payload.goal === "string" || Array.isArray(payload.tasks)) {
    return planCardFromSnapshot(payload);
  }
  return null;
}

export function applyPlanStreamEvent(input: {
  prev: PlanCardModel | null;
  eventType: string;
  payload: Record<string, unknown>;
}): PlanCardModel | null {
  const { prev, eventType, payload } = input;
  if (
    eventType === PLAN_EVENTS.planPublished ||
    eventType === PLAN_EVENTS.replan
  ) {
    return planFromPublishedPayload(payload) ?? prev;
  }
  if (eventType === "followup_queued") {
    if (!prev) return prev;
    const text = typeof payload.text === "string" ? payload.text : "";
    return {
      ...prev,
      queuedFollowUp: text ? { text } : prev.queuedFollowUp
    };
  }
  if (eventType === PLAN_EVENTS.planStatus) {
    if (!prev) return prev;
    const status = String(payload.status ?? prev.status);
    return {
      ...prev,
      status: status as PlanCardModel["status"],
      budgetStopReason:
        typeof payload.reason === "string"
          ? payload.reason
          : prev.budgetStopReason
    };
  }
  if (eventType === PLAN_EVENTS.taskUpdated) {
    if (!prev) return prev;
    const patch = taskPatchFromPayload(payload);
    if (!patch) return prev;
    return {
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === patch.id
          ? {
              ...t,
              status: patch.status
                ? (patch.status as PlanCardTaskStatus)
                : t.status,
              error: patch.error ?? t.error
            }
          : t
      )
    };
  }
  return prev;
}

function snapshotWithLiveTasks(
  plan: Record<string, unknown> | null | undefined,
  tasks: unknown
): Record<string, unknown> | null {
  if (!plan || typeof plan !== "object") return null;
  if (!Array.isArray(tasks) || tasks.length === 0) return plan;
  return { ...plan, tasks };
}

const TASK_STATUS_RANK: Record<string, number> = {
  pending: 0,
  running: 1,
  waiting: 2,
  completed: 3,
  failed: 3,
  cancelled: 3
};

export function mergePlanPreferringProgress(
  prev: PlanCardModel | null,
  next: PlanCardModel | null
): PlanCardModel | null {
  if (!next) return prev;
  if (!prev) return next;
  if (next.version < prev.version) return prev;
  if (next.version > prev.version) return next;
  const prevById = new Map(prev.tasks.map((t) => [t.id, t]));
  return {
    ...next,
    status:
      (TASK_STATUS_RANK[next.status] ?? 0) >=
      (TASK_STATUS_RANK[prev.status] ?? 0)
        ? next.status
        : prev.status,
    tasks: next.tasks.map((t) => {
      const older = prevById.get(t.id);
      if (!older) return t;
      const nextRank = TASK_STATUS_RANK[t.status] ?? 0;
      const prevRank = TASK_STATUS_RANK[older.status] ?? 0;
      if (prevRank > nextRank) {
        return { ...t, status: older.status, error: older.error ?? t.error };
      }
      return t;
    }),
    queuedFollowUp: next.queuedFollowUp ?? prev.queuedFollowUp
  };
}

export function usePlanStream(options: {
  sessionId: string;
  enabled?: boolean;
}): {
  plan: PlanCardModel | null;
  setPlan: React.Dispatch<React.SetStateAction<PlanCardModel | null>>;
  onPlanEvent: (eventType: string, payload: Record<string, unknown>) => void;
} {
  const { sessionId, enabled = true } = options;
  const [plan, setPlan] = useState<PlanCardModel | null>(null);

  useEffect(() => {
    if (!enabled || !sessionId) return;
    let cancelled = false;
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          `/api/sessions/${encodeURIComponent(sessionId)}/plans/current`,
          { signal: ac.signal }
        );
        if (!res.ok) return;
        const body = (await res.json()) as {
          plan?: Record<string, unknown> | null;
          tasks?: unknown;
        };
        if (cancelled) return;
        const merged = snapshotWithLiveTasks(body.plan, body.tasks);
        const fetched = planCardFromSnapshot(merged);
        setPlan((prev) => mergePlanPreferringProgress(prev, fetched));
      } catch {
        void 0;
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [sessionId, enabled]);

  const onPlanEvent = useCallback(
    (eventType: string, payload: Record<string, unknown>) => {
      setPlan((prev) => applyPlanStreamEvent({ prev, eventType, payload }));
    },
    []
  );

  return { plan, setPlan, onPlanEvent };
}
