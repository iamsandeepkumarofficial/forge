import { api, withHeartbeats } from "./chatApi.js";
import { PLAN_SSE_EVENTS } from "@forge/core";
import { appendPlanChunk } from "./plan.js";

export async function ensureTaskWorktree(input: {
  sessionId: string;
  taskId: string;
}): Promise<{ worktreePath: string }> {
  const res = await withHeartbeats({
    work: api(`/internal/workflow/task-worktree`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
    detail: `ensureTaskWorktree:${input.taskId}`
  });
  return (await res.json()) as { worktreePath: string };
}

export async function mergeTaskWorktree(input: {
  sessionId: string;
  taskId: string;
  taskWorktreePath: string;
}): Promise<{
  ok: boolean;
  conflict?: boolean;
  paths?: string[];
  message?: string;
}> {
  const res = await withHeartbeats({
    work: api(`/internal/workflow/merge-task-worktree`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
    detail: `mergeTaskWorktree:${input.taskId}`
  });
  return (await res.json()) as {
    ok: boolean;
    conflict?: boolean;
    paths?: string[];
    message?: string;
  };
}

export async function publishMergeConflict(input: {
  turnId: string;
  status: "resolving" | "waiting_human" | "merged";
  paths?: string[];
  originatingTaskIds?: string[];
  resolverAttemptCount?: number;
}): Promise<void> {
  await appendPlanChunk({
    turnId: input.turnId,
    eventType: PLAN_SSE_EVENTS.mergeConflict,
    payload: {
      status: input.status,
      paths: input.paths ?? [],
      originatingTaskIds: input.originatingTaskIds ?? [],
      resolverAttemptCount: input.resolverAttemptCount ?? 0
    }
  });
}
