import { runnerUrl } from "./tool-runner.js";

export type RuntimeActivitySession = {
  sessionId: string;
  chatId?: string;
  projectId?: string | null;
  workspaceId?: string | null;
  title: string;
  status: string;
  running: boolean;
  runtime: string;
};

export type RuntimeActivityApp = {
  sessionId: string;
  name: string;
  previewUrl?: string;
  hostPort?: number;
  running: boolean;
};

export type RuntimeActivity = {
  runtimeKind: string;
  sessions: RuntimeActivitySession[];
  apps: RuntimeActivityApp[];
  ports: Array<{ sessionId: string; ports: number[] }>;
};

export async function fetchRuntimeActivity(): Promise<RuntimeActivity> {
  const res = await fetch(`${runnerUrl()}/api/runtime/activity`);
  if (!res.ok) {
    throw new Error(`Failed to load activity (${res.status})`);
  }
  return (await res.json()) as RuntimeActivity;
}

export async function stopRuntimeSession(sessionId: string): Promise<void> {
  const res = await fetch(
    `${runnerUrl()}/api/runtime/activity/sessions/${encodeURIComponent(sessionId)}/stop`,
    { method: "POST" }
  );
  if (!res.ok) {
    throw new Error(`Failed to stop session (${res.status})`);
  }
}

export async function stopRuntimeApp(options: {
  sessionId: string;
  name: string;
}): Promise<void> {
  const res = await fetch(`${runnerUrl()}/api/runtime/activity/apps/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options)
  });
  if (!res.ok) {
    throw new Error(`Failed to stop app (${res.status})`);
  }
}

export function chatHrefForSession(
  session: RuntimeActivitySession
): string | null {
  if (session.workspaceId && session.chatId) {
    return `/workspaces/${session.workspaceId}/chats/${session.chatId}`;
  }
  if (session.workspaceId && session.chatId) {
    return `/workspaces/${session.workspaceId}/chats/${session.chatId}`;
  }
  if (session.projectId && session.chatId) {
    return `/projects/${session.projectId}/chats/${session.chatId}`;
  }
  return null;
}
