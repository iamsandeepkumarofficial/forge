import {
  blockedWorkspaceMutationMessage,
  isBlockedWorkspaceMutationCommand,
  isLongRunningDevServerCommand,
  longRunningDevServerDeniedMessage
} from "@forge/core";
import { randomBytes } from "node:crypto";
import {
  resolveSandbox,
  resolveWorkspacePath,
  dockerExec,
  pathExistsInSandbox
} from "../projects/sandboxExec.js";
import {
  sanitizeJobName,
  startBackgroundJob,
  waitUntilJobRunning
} from "../projects/backgroundJob.js";
import {
  listTerminalJobStatuses,
  stopTerminalJob,
  terminalJobLogs,
  writeTerminalJobMeta
} from "../projects/terminalJobs.js";
import type { ToolResult } from "./types.js";

const MAX_OUTPUT_CHARS = 20000;
const N_8 = 8;

export type TerminalAction = "run" | "logs" | "status" | "stop";

export function parseTerminalAction(raw: unknown): TerminalAction | undefined {
  if (raw === "logs" || raw === "status" || raw === "stop" || raw === "run") {
    return raw;
  }
  return undefined;
}

export async function runTerminalInSession(options: {
  sessionId: string;
  command: string;
  workingDirectory?: string;
  maxOutputChars?: number;
  background?: boolean;
  jobName?: string;
  action?: TerminalAction;
  tail?: number;
}): Promise<ToolResult> {
  const action = options.action ?? "run";
  if (action === "logs") {
    return handleTerminalLogs(options);
  }
  if (action === "status") {
    return handleTerminalStatus(options);
  }
  if (action === "stop") {
    return handleTerminalStop(options);
  }
  return handleTerminalRun(options);
}

async function handleTerminalRun(options: {
  sessionId: string;
  command: string;
  workingDirectory?: string;
  maxOutputChars?: number;
  background?: boolean;
  jobName?: string;
}): Promise<ToolResult> {
  const commandTrimmed = options.command.trim();
  if (!commandTrimmed) {
    return { success: false, output: "command is required" };
  }
  if (isBlockedWorkspaceMutationCommand(commandTrimmed)) {
    return {
      success: false,
      output: blockedWorkspaceMutationMessage()
    };
  }
  if (isLongRunningDevServerCommand(commandTrimmed)) {
    return {
      success: false,
      output: longRunningDevServerDeniedMessage()
    };
  }
  const sandbox = await resolveSandbox(options.sessionId);
  const cwd = await resolveTerminalCwd({
    containerName: sandbox.containerName,
    sessionId: options.sessionId,
    repoDir: sandbox.repoDir,
    workingDir: sandbox.workingDir,
    worktrees: sandbox.worktrees,
    command: commandTrimmed,
    workingDirectory: options.workingDirectory
  });
  if ("error" in cwd) {
    return { success: false, output: cwd.error };
  }
  if (options.background) {
    return startBackgroundTerminal({
      containerName: sandbox.containerName,
      sessionId: options.sessionId,
      cwd: cwd.cwd,
      command: commandTrimmed,
      jobName: options.jobName
    });
  }
  const maxOut = options.maxOutputChars ?? MAX_OUTPUT_CHARS;
  const r = await dockerExec({
    container: sandbox.containerName,
    sessionId: options.sessionId,

    argv: ["sh", "-c", commandTrimmed],
    cwd: cwd.cwd
  });
  const combined = [r.stdout, r.stderr]
    .filter((s) => s && s.length > 0)
    .join("\n");
  return {
    success: r.code === 0,
    output: capChars(combined, maxOut) || "(no output)",
    metadata: { exitCode: r.code }
  };
}

export async function resolveTerminalCwd(options: {
  containerName: string;
  sessionId: string;
  repoDir: string;
  workingDir: string;
  command: string;
  workingDirectory?: string;
  worktrees?: Record<string, string>;
}): Promise<{ cwd: string } | { error: string }> {
  const wd = String(options.workingDirectory ?? "").trim();
  const worktrees = options.worktrees;
  const knownRepos =
    worktrees && Object.keys(worktrees).length > 0
      ? new Set(Object.keys(worktrees))
      : undefined;

  let cwd: string;
  if (!wd || wd === ".") {
    if (worktrees) {
      const mounts = Object.values(worktrees);
      cwd = mounts.length === 1 ? mounts[0]! : options.workingDir;
    } else {
      cwd = options.workingDir;
    }
  } else if (worktrees?.[wd]) {
    cwd = worktrees[wd];
  } else if (!worktrees && wd === options.repoDir) {
    cwd = options.workingDir;
  } else {
    cwd = resolveWorkspacePath(wd, { knownRepos });
  }

  if (
    options.command.startsWith("git") &&
    !(await pathExistsInSandbox({
      container: options.containerName,
      absPath: `${cwd}/.git`,
      sessionId: options.sessionId
    }))
  ) {
    const hint = knownRepos
      ? `Pass workingDirectory as a member repo (${[...knownRepos].sort().join(", ")}).`
      : `Default cwd is ${options.workingDir}.`;
    return {
      error: `Not a git repository: ${cwd}. ${hint}`
    };
  }
  return { cwd };
}

async function startBackgroundTerminal(options: {
  containerName: string;
  sessionId: string;
  cwd: string;
  command: string;
  jobName?: string;
}): Promise<ToolResult> {
  const jobName = sanitizeOptionalJobName(options.jobName) || defaultJobName();
  await writeTerminalJobMeta({
    containerName: options.containerName,
    name: jobName,
    sessionId: options.sessionId,
    meta: {
      command: options.command,
      cwd: options.cwd,
      startedAt: new Date().toISOString()
    }
  });
  await startBackgroundJob({
    containerName: options.containerName,
    kind: "term",
    name: jobName,
    cwd: options.cwd,
    command: options.command,
    sessionId: options.sessionId
  });
  const running = await waitUntilJobRunning({
    containerName: options.containerName,
    kind: "term",
    name: jobName,
    sessionId: options.sessionId
  });
  const logs = await terminalJobLogs({
    containerName: options.containerName,
    name: jobName,
    sessionId: options.sessionId
  });
  if (logs.includes("cwd not found:")) {
    return {
      success: false,
      output: `Background job ${jobName} failed.\n${logs.trim()}`,
      metadata: { jobName, running: false }
    };
  }
  const logTail = logs.trim()
    ? `\n${capChars(logs.trim(), MAX_OUTPUT_CHARS)}`
    : "";
  if (running) {
    return {
      success: true,
      output: `Background job ${jobName} is running.${logTail}\nPoll with run_terminal action=logs jobName=${jobName}. Stop with action=stop.`,
      metadata: { jobName, running: true }
    };
  }
  return {
    success: true,
    output: `Background job ${jobName} exited.${logTail || "\n(no log output)"}`,
    metadata: { jobName, running: false }
  };
}

async function handleTerminalLogs(options: {
  sessionId: string;
  jobName?: string;
  tail?: number;
}): Promise<ToolResult> {
  const jobName = sanitizeOptionalJobName(options.jobName);
  if (!jobName) {
    return { success: false, output: "jobName is required for action=logs" };
  }
  const { containerName } = await resolveSandbox(options.sessionId);
  const logs = await terminalJobLogs({
    containerName,
    name: jobName,
    tail: options.tail,
    sessionId: options.sessionId
  });
  return {
    success: true,
    output: logs.trim() || "(no log output yet)",
    metadata: { jobName }
  };
}

async function handleTerminalStatus(options: {
  sessionId: string;
  jobName?: string;
}): Promise<ToolResult> {
  const { containerName } = await resolveSandbox(options.sessionId);
  const jobs = await listTerminalJobStatuses(containerName, options.sessionId);
  const jobName = sanitizeOptionalJobName(options.jobName);
  const filtered = jobName ? jobs.filter((j) => j.name === jobName) : jobs;
  if (filtered.length === 0) {
    return {
      success: true,
      output: jobName
        ? `No terminal job named ${jobName}.`
        : "No background terminal jobs.",
      metadata: { jobs: filtered }
    };
  }
  const output = filtered
    .map((j) =>
      [
        `name: ${j.name}`,
        `running: ${j.running}`,
        j.command ? `command: ${j.command}` : null,
        j.cwd ? `cwd: ${j.cwd}` : null
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n---\n\n");
  return { success: true, output, metadata: { jobs: filtered } };
}

async function handleTerminalStop(options: {
  sessionId: string;
  jobName?: string;
}): Promise<ToolResult> {
  const jobName = sanitizeOptionalJobName(options.jobName);
  if (!jobName) {
    return { success: false, output: "jobName is required for action=stop" };
  }
  const { containerName } = await resolveSandbox(options.sessionId);
  await stopTerminalJob({
    containerName,
    name: jobName,
    sessionId: options.sessionId
  });
  return {
    success: true,
    output: `Stopped terminal job ${jobName}`,
    metadata: { jobName }
  };
}

function sanitizeOptionalJobName(raw?: string): string {
  const v = String(raw ?? "").trim();
  if (!v) {
    return "";
  }
  return sanitizeJobName(v);
}

function defaultJobName(): string {
  return `t${randomBytes(N_8).toString("hex")}`;
}

function capChars(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n\n… (truncated ${text.length - max} more chars — narrow your request)`;
}
