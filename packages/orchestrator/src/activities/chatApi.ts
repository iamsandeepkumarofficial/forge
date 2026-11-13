import { AGENT_TASK_STREAM_WORKFLOW_PREFIX } from "@forge/core";
import { heartbeat } from "@temporalio/activity";
import { env } from "../env.js";

export { AGENT_TASK_STREAM_WORKFLOW_PREFIX };

const N_15000 = 15000;

export async function withHeartbeats<T>(opts: {
  work: Promise<T>;
  detail: string | Record<string, unknown>;
  intervalMs?: number;
}): Promise<T> {
  const intervalMs = opts.intervalMs ?? N_15000;
  const payload =
    typeof opts.detail === "string"
      ? { detail: opts.detail, at: Date.now() }
      : { ...opts.detail, at: Date.now() };
  const beat = () => {
    try {
      heartbeat(payload);
    } catch {
      void 0;
    }
  };
  beat();
  const timer = setInterval(beat, intervalMs);
  try {
    return await opts.work;
  } finally {
    clearInterval(timer);
  }
}

export async function api(
  pathname: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(`${env.toolRunnerUrl}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`server ${res.status} on ${pathname}: ${body}`);
  }
  return res;
}

export type StoredMessage = {
  id: string;
  role: string;
  parts: unknown[];
};

export async function appendChunk(opts: {
  turnId: string;
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await api(`/internal/chat/turns/${opts.turnId}/chunks`, {
    method: "POST",
    body: JSON.stringify({
      eventType: opts.eventType,
      payload: opts.payload
    })
  });
}

export async function loadChatMessages(
  sessionId: string
): Promise<StoredMessage[]> {
  const res = await api(
    `/internal/chat/sessions/${encodeURIComponent(sessionId)}/messages`
  );
  const body = (await res.json()) as {
    messages: StoredMessage[];
  };
  return body.messages ?? [];
}

export async function appendChatMessage(input: {
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  parts: unknown[];
  turnId?: string;
}): Promise<StoredMessage> {
  const res = await api(
    `/internal/chat/sessions/${encodeURIComponent(input.sessionId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        role: input.role,
        parts: input.parts,
        turnId: input.turnId ?? null
      })
    }
  );
  return (await res.json()) as StoredMessage;
}

export async function ensureChatSandbox(sessionId: string): Promise<void> {
  await withHeartbeats({
    work: api(`/internal/session/start`, {
      method: "POST",
      body: JSON.stringify({ sessionId })
    }).catch(() => {}),
    detail: `ensureChatSandbox:${sessionId}`
  });
}

export async function getChatSystemPrompt(sessionId: string): Promise<string> {
  try {
    const res = await api(
      `/internal/system-prompt?sessionId=${encodeURIComponent(sessionId)}`
    );
    return await res.text();
  } catch {
    return "";
  }
}

export async function finishChatTurn(opts: {
  turnId: string;
  status: "completed" | "cancelled" | "failed";
  error?: string;
}): Promise<void> {
  await api(`/internal/chat/turns/${opts.turnId}/finish`, {
    method: "POST",
    body: JSON.stringify({ status: opts.status, error: opts.error ?? null })
  });
}

export async function createTaskStreamTurn(input: {
  sessionId: string;
  planId: string;
  taskId: string;
  attempt: number;
  provider?: string;
  model?: string;
}): Promise<{ turnId: string; workflowId: string }> {
  const workflowId = `${AGENT_TASK_STREAM_WORKFLOW_PREFIX}${input.sessionId}-${input.planId}-${input.taskId}-${input.attempt}`;
  const res = await api(`/internal/chat/turns`, {
    method: "POST",
    body: JSON.stringify({
      sessionId: input.sessionId,
      workflowId,
      mode: "agent",
      provider: input.provider ?? null,
      model: input.model ?? null
    })
  });
  const turn = (await res.json()) as { id: string };
  return { turnId: turn.id, workflowId };
}
