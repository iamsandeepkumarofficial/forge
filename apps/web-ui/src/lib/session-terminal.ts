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
