import { runnerUrl } from "./tool-runner.js";

export type TerminalJobStatus = {
  name: string;
  running: boolean;
  command?: string;
  cwd?: string;
  startedAt?: string;
};

export type TerminalTabKind = "shell" | "app" | "job";

export type TerminalTab = {
  id: string;
  kind: TerminalTabKind;
  label: string;
  running: boolean;
  closable: boolean;
  stoppable?: boolean;
};

export async function listTerminalJobs(
  sessionId: string,
  signal?: AbortSignal
): Promise<TerminalJobStatus[]> {
  const u = new URL(`${runnerUrl()}/internal/terminal/jobs`);
  u.searchParams.set("sessionId", sessionId);
  const res = await fetch(u.toString(), { signal });
  const body = (await res.json()) as {
    jobs?: TerminalJobStatus[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error || String(res.status));
  }
  return Array.isArray(body.jobs) ? body.jobs : [];
}

export async function listTerminalTabs(
  sessionId: string,
  signal?: AbortSignal
): Promise<TerminalTab[]> {
  const u = new URL(`${runnerUrl()}/internal/terminal/tabs`);
  u.searchParams.set("sessionId", sessionId);
  const res = await fetch(u.toString(), { signal });
  const body = (await res.json()) as { tabs?: TerminalTab[]; error?: string };
  if (!res.ok) {
    throw new Error(body.error || String(res.status));
  }
  return Array.isArray(body.tabs) ? body.tabs : [];
}

export async function createShellTab(
  sessionId: string,
  signal?: AbortSignal
): Promise<{ tabId: string; tab: TerminalTab }> {
  const res = await fetch(`${runnerUrl()}/internal/terminal/tabs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
    signal
  });
  const body = (await res.json()) as {
    tabId?: string;
    tab?: TerminalTab;
    error?: string;
  };
  if (!res.ok || !body.tabId || !body.tab) {
    throw new Error(body.error || String(res.status));
  }
  return { tabId: body.tabId, tab: body.tab };
}

export async function closeShellTab(
  sessionId: string,
  tabId: string,
  signal?: AbortSignal
): Promise<void> {
  const u = new URL(
    `${runnerUrl()}/internal/terminal/tabs/${encodeURIComponent(tabId)}`
  );
  u.searchParams.set("sessionId", sessionId);
  const res = await fetch(u.toString(), { method: "DELETE", signal });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || String(res.status));
  }
}

export async function stopTerminalJob(
  sessionId: string,
  name: string,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${runnerUrl()}/internal/terminal/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, name }),
    signal
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || String(res.status));
  }
}
