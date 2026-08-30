import { runnerUrl } from "./tool-runner.js";

export type TerminalJobStatus = {
  name: string;
  running: boolean;
  command?: string;
  cwd?: string;
};

export type TerminalLogsResponse = {
  jobs: TerminalJobStatus[];
  logs: Record<string, string>;
};

export async function fetchAllTerminalLogs(
  sessionId: string,
  signal?: AbortSignal
): Promise<TerminalLogsResponse> {
  const u = new URL(`${runnerUrl()}/internal/terminal/logs`);
  u.searchParams.set("sessionId", sessionId);
  const res = await fetch(u.toString(), {
    signal
  });
  if (!res.ok) {
    throw new Error((await res.text()).trim() || String(res.status));
  }
  const body = (await res.json()) as TerminalLogsResponse & { error?: string };
  if (body.error && !body.logs) {
    throw new Error(body.error);
  }
  return {
    jobs: Array.isArray(body.jobs) ? body.jobs : [],
    logs: body.logs && typeof body.logs === "object" ? body.logs : {}
  };
}

export async function runTerminalCommand(options: {
  sessionId: string;
  command: string;
  background?: boolean;
  workingDirectory?: string;
  jobName?: string;
  signal?: AbortSignal;
}): Promise<{
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}> {
  const { sessionId, command, background, workingDirectory, jobName, signal } =
    options;
  const res = await fetch(`${runnerUrl()}/internal/terminal/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      command,
      background,
      workingDirectory,
      jobName
    }),
    signal
  });
  const data = (await res.json()) as {
    success?: boolean;
    output?: string;
    metadata?: Record<string, unknown>;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || String(res.status));
  }
  return {
    success: Boolean(data.success),
    output: typeof data.output === "string" ? data.output : "",
    metadata: data.metadata
  };
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
