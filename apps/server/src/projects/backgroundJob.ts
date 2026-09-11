import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { dockerExec } from "./sandboxExec.js";
import {
  HOST_JOB_PID_EXTERNAL_ENV,
  persistExternalJobPid,
  stopJobHadPid,
  stopJobScript
} from "./backgroundJobPid.js";

export {
  HOST_JOB_PID_EXTERNAL_ENV,
  persistExternalJobPid,
  STOP_HAD_PID_TOKEN,
  STOP_NO_PID_TOKEN,
  stopJobHadPid,
  stopJobScript
} from "./backgroundJobPid.js";

const execFileAsync = promisify(execFile);

const N_60 = 60;
const N_200 = 200;
const N_300 = 300;
const N_500 = 500;
const N_2000 = 2000;
const START_POLL_TRIES = 10;
const TCP_READY_TRIES = 120;
const TCP_READY_INTERVAL_MS = N_500;

export type BackgroundJobKind = "app" | "term";

export function sanitizeJobName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, N_60) || "job";
}

export function jobPidFile(options: {
  kind: BackgroundJobKind;
  name: string;
  workspaceRoot?: string;
}): string {
  const base = `forge-${options.kind}-${sanitizeJobName(options.name)}.pid`;
  if (options.workspaceRoot) {
    return path.join(options.workspaceRoot, ".forge-runtime", base);
  }
  return `/tmp/${base}`;
}

export function jobLogFile(options: {
  kind: BackgroundJobKind;
  name: string;
  workspaceRoot?: string;
}): string {
  const base = `forge-${options.kind}-${sanitizeJobName(options.name)}.log`;
  if (options.workspaceRoot) {
    return path.join(options.workspaceRoot, ".forge-runtime", base);
  }
  return `/tmp/${base}`;
}

export function startJobScript(): string {
  return [
    ': > "$LOG"',
    'if ! cd "$APPDIR"; then echo "cwd not found: $APPDIR" >> "$LOG"; exit 1; fi',
    'printf \'$ %s\\n\' "$CMD" >> "$LOG"',
    `if [ -z "$${HOST_JOB_PID_EXTERNAL_ENV}" ]; then echo $$ > "$PID"; fi`,
    'exec sh -c "$CMD" >> "$LOG" 2>&1'
  ].join("; ");
}

async function resolveKind(
  sessionId?: string
): Promise<"host" | "docker" | "kubernetes"> {
  if (!sessionId) return "docker";
  const { resolveSandboxRuntimeKindForSession } =
    await import("./sandboxRuntime/resolve.js");
  return resolveSandboxRuntimeKindForSession(sessionId);
}

export async function startBackgroundJob(options: {
  containerName: string;
  kind: BackgroundJobKind;
  name: string;
  cwd: string;
  command: string;
  extraEnv?: Record<string, string>;
  sessionId?: string;
}): Promise<void> {
  const kind = await resolveKind(options.sessionId);
  const workspaceRoot = kind === "host" ? options.containerName : undefined;
  let publishedPorts = "3000-3009";
  if (options.sessionId) {
    try {
      const { getSandboxRuntime } = await import("./sandboxRuntime/resolve.js");
      publishedPorts = (
        await getSandboxRuntime(options.sessionId)
      ).publishedAppPortsEnv();
    } catch {
      void 0;
    }
  }
  const env: Record<string, string> = {
    APPDIR: options.cwd,
    PID: jobPidFile({
      kind: options.kind,
      name: options.name,
      workspaceRoot
    }),
    LOG: jobLogFile({
      kind: options.kind,
      name: options.name,
      workspaceRoot
    }),
    CMD: options.command,
    HOST: kind === "host" ? "127.0.0.1" : "0.0.0.0",
    FORGE_PUBLISHED_APP_PORTS: publishedPorts,
    ...options.extraEnv
  };
  if (kind === "host") {
    env[HOST_JOB_PID_EXTERNAL_ENV] = "1";
  }
  const argv =
    kind === "host"
      ? ["sh", "-c", startJobScript()]
      : ["setsid", "sh", "-c", startJobScript()];
  const started = await dockerExec({
    container: options.containerName,
    sessionId: options.sessionId,
    argv,
    env,
    detach: true
  });
  if (kind === "host") {
    await persistExternalJobPid({ pidFile: env.PID, pid: started.pid });
  }
}

export async function stopBackgroundJob(options: {
  containerName: string;
  kind: BackgroundJobKind;
  name: string;
  sessionId?: string;
}): Promise<{ hadPid: boolean }> {
  const kind = await resolveKind(options.sessionId);
  const workspaceRoot = kind === "host" ? options.containerName : undefined;
  const pf = jobPidFile({
    kind: options.kind,
    name: options.name,
    workspaceRoot
  });
  const r = await dockerExec({
    container: options.containerName,
    sessionId: options.sessionId,
    argv: ["sh", "-c", stopJobScript(pf)]
  });
  return { hadPid: stopJobHadPid(r.stdout) };
}

export function freeListeningPortScript(port: number): string {
  const p = Math.floor(port);
  return `
port=${p}
hex=$(printf '%04X' "$port")
inodes=$(
  for proto in /proc/net/tcp /proc/net/tcp6; do
    [ -r "$proto" ] || continue
    awk -v hex="$hex" 'BEGIN { hex = toupper(hex) } NR > 1 {
      split($2, a, ":");
      if (toupper(a[2]) == hex && $4 == "0A") print $10
    }' "$proto"
  done | sort -u
)
[ -z "$inodes" ] && exit 0
for inode in $inodes; do
  for fd in /proc/[0-9]*/fd/*; do
    link=$(readlink "$fd" 2>/dev/null) || continue
    if [ "$link" = "socket:[$inode]" ]; then
      pid=$(echo "$fd" | cut -d/ -f3)
      kill -TERM "$pid" 2>/dev/null
    fi
  done
done
sleep 0.3
for inode in $inodes; do
  for fd in /proc/[0-9]*/fd/*; do
    link=$(readlink "$fd" 2>/dev/null) || continue
    if [ "$link" = "socket:[$inode]" ]; then
      pid=$(echo "$fd" | cut -d/ -f3)
      kill -KILL "$pid" 2>/dev/null
    fi
  done
done
`.trim();
}

export function freeListeningPortHostScript(port: number): string {
  const p = Math.floor(port);
  return `
port=${p}
kill_pids() {
  sig="$1"
  shift
  for pid in "$@"; do
    [ -n "$pid" ] || continue
    kill -"$sig" "$pid" 2>/dev/null || true
  done
}
pids=""
if command -v lsof >/dev/null 2>&1; then
  pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
elif [ -r /proc/net/tcp ]; then
  ${freeListeningPortScript(p)}
  exit 0
fi
[ -z "$pids" ] && exit 0
# shellcheck disable=SC2086
kill_pids TERM $pids
sleep 0.3
still=""
if command -v lsof >/dev/null 2>&1; then
  still=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
fi
[ -z "$still" ] && exit 0
# shellcheck disable=SC2086
kill_pids KILL $still
`.trim();
}

export async function freeListeningPort(options: {
  containerName: string;
  port: number;
  sessionId?: string;
}): Promise<void> {
  const port = Math.floor(options.port);
  if (!Number.isFinite(port) || port < 1) return;
  if ((await resolveKind(options.sessionId)) === "host") {
    await execFileAsync("sh", ["-c", freeListeningPortHostScript(port)], {
      timeout: 5000
    }).catch(() => undefined);
    return;
  }
  await dockerExec({
    container: options.containerName,
    sessionId: options.sessionId,
    argv: ["sh", "-c", freeListeningPortScript(port)]
  }).catch(() => undefined);
}

export async function isBackgroundJobRunning(options: {
  containerName: string;
  kind: BackgroundJobKind;
  name: string;
  sessionId?: string;
}): Promise<boolean> {
  const kind = await resolveKind(options.sessionId);
  const workspaceRoot = kind === "host" ? options.containerName : undefined;
  const pf = jobPidFile({
    kind: options.kind,
    name: options.name,
    workspaceRoot
  });
  const r = await dockerExec({
    container: options.containerName,
    sessionId: options.sessionId,
    argv: [
      "sh",
      "-c",
      `P=$(cat "${pf}" 2>/dev/null); if [ -n "$P" ] && kill -0 "$P" 2>/dev/null; then echo 1; else echo 0; fi`
    ]
  });
  return r.stdout.trim() === "1";
}

export async function readBackgroundJobLogs(options: {
  containerName: string;
  kind: BackgroundJobKind;
  name: string;
  tail?: number;
  sessionId?: string;
}): Promise<string> {
  const kind = await resolveKind(options.sessionId);
  const workspaceRoot = kind === "host" ? options.containerName : undefined;
  const tail = Math.max(1, Math.min(N_2000, options.tail ?? N_300));
  const lf = jobLogFile({
    kind: options.kind,
    name: options.name,
    workspaceRoot
  });
  const r = await dockerExec({
    container: options.containerName,
    sessionId: options.sessionId,
    argv: ["sh", "-c", `tail -n ${tail} "${lf}" 2>/dev/null`]
  });
  return r.stdout;
}

export async function waitUntilJobRunning(options: {
  containerName: string;
  kind: BackgroundJobKind;
  name: string;
  tries?: number;
  intervalMs?: number;
  sessionId?: string;
}): Promise<boolean> {
  const tries = options.tries ?? START_POLL_TRIES;
  const intervalMs = options.intervalMs ?? N_200;
  for (let i = 0; i < tries; i += 1) {
    if (
      await isBackgroundJobRunning({
        containerName: options.containerName,
        kind: options.kind,
        name: options.name,
        sessionId: options.sessionId
      })
    ) {
      return true;
    }
    if (i + 1 < tries && intervalMs > 0) {
      await sleepMs(intervalMs);
    }
  }
  return false;
}

export async function isTcpListening(options: {
  containerName: string;
  port: number;
  sessionId?: string;
}): Promise<boolean> {
  const port = Math.floor(options.port);
  if (!Number.isFinite(port) || port < 1) {
    return false;
  }
  if ((await resolveKind(options.sessionId)) === "host") {
    return isHostTcpListening(port);
  }
  const r = await dockerExec({
    container: options.containerName,
    sessionId: options.sessionId,
    argv: [
      "bash",
      "-c",
      `exec 3<>/dev/tcp/127.0.0.1/${port} && echo 1 || echo 0`
    ]
  });
  return r.stdout.trim() === "1";
}

export async function waitUntilTcpListening(options: {
  containerName: string;
  port: number;
  tries?: number;
  intervalMs?: number;
  sessionId?: string;
}): Promise<boolean> {
  const tries = options.tries ?? TCP_READY_TRIES;
  const intervalMs = options.intervalMs ?? TCP_READY_INTERVAL_MS;
  for (let i = 0; i < tries; i += 1) {
    if (
      await isTcpListening({
        containerName: options.containerName,
        port: options.port,
        sessionId: options.sessionId
      })
    ) {
      return true;
    }
    if (i + 1 < tries && intervalMs > 0) {
      await sleepMs(intervalMs);
    }
  }
  return false;
}

export async function isHostTcpListening(port: number): Promise<boolean> {
  const net = await import("node:net");
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(N_500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export async function waitUntilHostTcpListening(options: {
  port: number;
  tries?: number;
  intervalMs?: number;
}): Promise<boolean> {
  const tries = options.tries ?? Math.min(TCP_READY_TRIES, N_60);
  const intervalMs = options.intervalMs ?? TCP_READY_INTERVAL_MS;
  for (let i = 0; i < tries; i += 1) {
    if (await isHostTcpListening(options.port)) return true;
    if (i + 1 < tries && intervalMs > 0) await sleepMs(intervalMs);
  }
  return false;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
