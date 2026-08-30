import { dockerExec } from "./sandboxExec.js";

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
}): string {
  return `/tmp/forge-${options.kind}-${sanitizeJobName(options.name)}.pid`;
}

export function jobLogFile(options: {
  kind: BackgroundJobKind;
  name: string;
}): string {
  return `/tmp/forge-${options.kind}-${sanitizeJobName(options.name)}.log`;
}

export function startJobScript(): string {
  return [
    ': > "$LOG"',
    'if ! cd "$APPDIR"; then echo "cwd not found: $APPDIR" >> "$LOG"; exit 1; fi',
    'echo $$ > "$PID"',
    'exec sh -c "$CMD" >> "$LOG" 2>&1'
  ].join("; ");
}

export async function startBackgroundJob(options: {
  containerName: string;
  kind: BackgroundJobKind;
  name: string;
  cwd: string;
  command: string;
  extraEnv?: Record<string, string>;
}): Promise<void> {
  const env: Record<string, string> = {
    APPDIR: options.cwd,
    PID: jobPidFile({ kind: options.kind, name: options.name }),
    LOG: jobLogFile({ kind: options.kind, name: options.name }),
    CMD: options.command,
    HOST: "0.0.0.0",
    FORGE_PUBLISHED_APP_PORTS: "3000-3009",
    ...options.extraEnv
  };
  await dockerExec({
    container: options.containerName,
    argv: ["setsid", "sh", "-c", startJobScript()],
    env,
    detach: true
  });
}

export async function stopBackgroundJob(options: {
  containerName: string;
  kind: BackgroundJobKind;
  name: string;
}): Promise<void> {
  const pf = jobPidFile({ kind: options.kind, name: options.name });
  await dockerExec({
    container: options.containerName,
    argv: [
      "sh",
      "-c",
      `P=$(cat "${pf}" 2>/dev/null); if [ -n "$P" ]; then kill -TERM -"$P" 2>/dev/null; kill -TERM "$P" 2>/dev/null; sleep 0.2; kill -KILL -"$P" 2>/dev/null; kill -KILL "$P" 2>/dev/null; fi; rm -f "${pf}"`
    ]
  });
}

/**
 * Kill whatever is listening on a container TCP port (orphaned next/node children
 * often survive after the forge job pid file is gone).
 */
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

export async function freeListeningPort(options: {
  containerName: string;
  port: number;
}): Promise<void> {
  const port = Math.floor(options.port);
  if (!Number.isFinite(port) || port < 1) return;
  await dockerExec({
    container: options.containerName,
    argv: ["sh", "-c", freeListeningPortScript(port)]
  }).catch(() => undefined);
}

export async function isBackgroundJobRunning(options: {
  containerName: string;
  kind: BackgroundJobKind;
  name: string;
}): Promise<boolean> {
  const pf = jobPidFile({ kind: options.kind, name: options.name });
  const r = await dockerExec({
    container: options.containerName,
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
}): Promise<string> {
  const tail = Math.max(1, Math.min(N_2000, options.tail ?? N_300));
  const lf = jobLogFile({ kind: options.kind, name: options.name });
  const r = await dockerExec({
    container: options.containerName,
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
}): Promise<boolean> {
  const tries = options.tries ?? START_POLL_TRIES;
  const intervalMs = options.intervalMs ?? N_200;
  for (let i = 0; i < tries; i += 1) {
    if (
      await isBackgroundJobRunning({
        containerName: options.containerName,
        kind: options.kind,
        name: options.name
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
}): Promise<boolean> {
  const port = Math.floor(options.port);
  if (!Number.isFinite(port) || port < 1) {
    return false;
  }
  const r = await dockerExec({
    container: options.containerName,
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
}): Promise<boolean> {
  const tries = options.tries ?? TCP_READY_TRIES;
  const intervalMs = options.intervalMs ?? TCP_READY_INTERVAL_MS;
  for (let i = 0; i < tries; i += 1) {
    if (
      await isTcpListening({
        containerName: options.containerName,
        port: options.port
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

/** Host-side check: Docker Desktop sometimes drops published port proxies. */
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
