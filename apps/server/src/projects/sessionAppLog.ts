import { spawn } from "node:child_process";
import {
  isBackgroundJobRunning,
  jobLogFile,
  type BackgroundJobKind
} from "./backgroundJob.js";
import { dockerLogFollowAttach } from "./dockerExecHttp.js";
import { isHostSession } from "./sandboxRuntime/resolve.js";

const INITIAL_TAIL = 500;
const EXIT_POLL_MS = 2000;
const RESTART_GRACE_MS = 3000;
const JOB_START_WAIT_MS = 4000;

export function nextLogFollowPoll(options: {
  running: boolean;
  seenRunning: boolean;
  notRunningSince: number | null;
  now: number;
  graceMs?: number;
  startedAt?: number;
  startWaitMs?: number;
}): {
  finish: boolean;
  seenRunning: boolean;
  notRunningSince: number | null;
} {
  const graceMs = options.graceMs ?? RESTART_GRACE_MS;
  if (options.running) {
    return { finish: false, seenRunning: true, notRunningSince: null };
  }
  if (!options.seenRunning) {
    if (
      options.startWaitMs != null &&
      options.startedAt != null &&
      options.now - options.startedAt >= options.startWaitMs
    ) {
      return {
        finish: true,
        seenRunning: false,
        notRunningSince: options.startedAt
      };
    }
    return {
      finish: false,
      seenRunning: false,
      notRunningSince: null
    };
  }
  const since = options.notRunningSince ?? options.now;
  return {
    finish: options.now - since >= graceMs,
    seenRunning: true,
    notRunningSince: since
  };
}

export type LogFollowHandle = {
  close: () => void;
};

export type AppLogFollowHandle = LogFollowHandle;

async function hostLogPath(options: {
  containerName: string;
  kind: BackgroundJobKind;
  name: string;
  sessionId: string;
}): Promise<string> {
  const host = await isHostSession(options.sessionId);
  return jobLogFile({
    kind: options.kind,
    name: options.name,
    workspaceRoot: host ? options.containerName : undefined
  });
}

function hostLogFollowAttach(options: {
  logPath: string;
  tailLines: number;
  onData: (chunk: Buffer) => void;
  onClose: (code: number | null) => void;
}): { close: () => void } {
  const child = spawn(
    "tail",
    ["-n", String(options.tailLines), "-F", options.logPath],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  let closed = false;
  const finish = (code: number | null) => {
    if (closed) return;
    closed = true;
    options.onClose(code);
  };
  child.stdout?.on("data", (c: Buffer) => {
    if (!closed && c.length > 0) options.onData(c);
  });
  child.stderr?.on("data", (c: Buffer) => {
    if (!closed && c.length > 0) options.onData(c);
  });
  child.on("close", (code) => finish(code));
  child.on("error", () => finish(null));
  return {
    close: () => {
      if (closed) return;
      closed = true;
      child.kill("SIGTERM");
    }
  };
}

export async function attachLogFollow(options: {
  containerName: string;
  sessionId: string;
  kind: BackgroundJobKind;
  name: string;
  onData: (chunk: Buffer) => void;
  onExited: () => void;
}): Promise<LogFollowHandle> {
  const logPath = await hostLogPath(options);
  let closed = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let followClose: (() => void) | undefined;
  let seenRunning = false;
  let notRunningSince: number | null = null;
  const attachedAt = Date.now();
  const startWaitMs = options.kind === "term" ? JOB_START_WAIT_MS : undefined;

  const finish = (notify = false) => {
    if (closed) return;
    closed = true;
    if (pollTimer !== undefined) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
    followClose?.();
    followClose = undefined;
    if (notify) {
      options.onExited();
    }
  };

  const follow = (await isHostSession(options.sessionId))
    ? hostLogFollowAttach({
        logPath,
        tailLines: INITIAL_TAIL,
        onData: options.onData,
        onClose: () => finish(true)
      })
    : await dockerLogFollowAttach({
        container: options.containerName,
        logPath,
        tailLines: INITIAL_TAIL,
        onData: options.onData,
        onClose: () => finish(true)
      });
  followClose = follow.close;

  pollTimer = setInterval(() => {
    void isBackgroundJobRunning({
      containerName: options.containerName,
      kind: options.kind,
      name: options.name,
      sessionId: options.sessionId
    }).then((running) => {
      if (closed) return;
      const next = nextLogFollowPoll({
        running,
        seenRunning,
        notRunningSince,
        now: Date.now(),
        startedAt: attachedAt,
        startWaitMs
      });
      seenRunning = next.seenRunning;
      notRunningSince = next.notRunningSince;
      if (next.finish) finish(true);
    });
  }, EXIT_POLL_MS);

  return {
    close: () => finish(false)
  };
}

export async function attachAppLogFollow(options: {
  containerName: string;
  sessionId: string;
  appName: string;
  onData: (chunk: Buffer) => void;
  onExited: () => void;
}): Promise<AppLogFollowHandle> {
  return attachLogFollow({
    containerName: options.containerName,
    sessionId: options.sessionId,
    kind: "app",
    name: options.appName,
    onData: options.onData,
    onExited: options.onExited
  });
}

export async function attachJobLogFollow(options: {
  containerName: string;
  sessionId: string;
  jobName: string;
  onData: (chunk: Buffer) => void;
  onExited: () => void;
}): Promise<LogFollowHandle> {
  return attachLogFollow({
    containerName: options.containerName,
    sessionId: options.sessionId,
    kind: "term",
    name: options.jobName,
    onData: options.onData,
    onExited: options.onExited
  });
}
