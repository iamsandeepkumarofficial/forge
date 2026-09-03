import type { TerminalJobStatus } from "../../lib/session-terminal.js";

export type TerminalStream = {
  id: string;
  label: string;
  running: boolean;
  command?: string;
  stoppable?: boolean;
};

const BACKGROUND_RE = /(?:^|\s)--watch(?:\s|$)|tail\s+-f|(?:^|\s)watch\s+/i;
const N_24 = 24;
const N_4 = 4;

export function shouldRunInBackground(command: string): boolean {
  return BACKGROUND_RE.test(command.trim());
}

export function jobNameFromCommand(command: string): string {
  const tokens = command.trim().split(/\s+/).slice(0, 3);
  const raw = tokens.join("-").replace(/[^a-zA-Z0-9_-]/g, "");
  const base = raw.slice(0, N_24) || "cmd";
  return `u-${base}-${Date.now().toString(36).slice(-N_4)}`;
}

export function buildAppStreams(
  apps: Array<{ name: string; running: boolean }>
): TerminalStream[] {
  return apps.map((a) => ({
    id: `app:${a.name}`,
    label: a.name,
    running: a.running
  }));
}

export function buildJobStreams(jobs: TerminalJobStatus[]): TerminalStream[] {
  return jobs.map((job) => ({
    id: `job:${job.name}`,
    label: jobLabel(job),
    running: job.running,
    command: job.command,
    stoppable: true
  }));
}

export function jobLabel(job: TerminalJobStatus): string {
  const cmd = job.command?.trim();
  if (cmd) return cmd.length > N_24 ? `${cmd.slice(0, N_24)}…` : cmd;
  return job.name;
}

export function appLogsByStream(
  appLogs: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [name, text] of Object.entries(appLogs)) {
    next[`app:${name}`] = text;
  }
  return next;
}

export function jobLogsByStream(
  jobLogs: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [name, text] of Object.entries(jobLogs)) {
    next[`job:${name}`] = text;
  }
  return next;
}

export function countRunningStreams(streams: TerminalStream[]): number {
  return streams.filter((s) => s.running).length;
}

export function formatShellEntry(command: string, output: string): string {
  const body = output.trim() || "(no output)";
  return `$ ${command}\n${body}`;
}
