import {
  isBackgroundJobRunning,
  jobLogFile,
  type BackgroundJobKind
} from "./backgroundJob.js";
import { dockerLogFollowAttach } from "./dockerExecHttp.js";

/** Replay on subscribe; single tail -F attach avoids gap between read and follow. */
const INITIAL_TAIL = 500;
const EXIT_POLL_MS = 2000;

export type LogFollowHandle = {
  close: () => void;
};

export type AppLogFollowHandle = LogFollowHandle;

export async function attachLogFollow(options: {
  containerName: string;
  kind: BackgroundJobKind;
  name: string;
  onData: (chunk: Buffer) => void;
  onExited: () => void;
}): Promise<LogFollowHandle> {
  const logPath = jobLogFile({ kind: options.kind, name: options.name });

  let closed = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let followClose: (() => void) | undefined;

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

  const follow = await dockerLogFollowAttach({
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
      name: options.name
    }).then((running) => {
      if (!running) {
        finish(true);
      }
    });
  }, EXIT_POLL_MS);

  return {
    close: () => finish(false)
  };
}

export async function attachAppLogFollow(options: {
  containerName: string;
  appName: string;
  onData: (chunk: Buffer) => void;
  onExited: () => void;
}): Promise<AppLogFollowHandle> {
  return attachLogFollow({
    containerName: options.containerName,
    kind: "app",
    name: options.appName,
    onData: options.onData,
    onExited: options.onExited
  });
}

export async function attachJobLogFollow(options: {
  containerName: string;
  jobName: string;
  onData: (chunk: Buffer) => void;
  onExited: () => void;
}): Promise<LogFollowHandle> {
  return attachLogFollow({
    containerName: options.containerName,
    kind: "term",
    name: options.jobName,
    onData: options.onData,
    onExited: options.onExited
  });
}
