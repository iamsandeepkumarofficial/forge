import fs from "node:fs/promises";
import path from "node:path";

export const HOST_JOB_PID_EXTERNAL_ENV = "FORGE_JOB_PID_EXTERNAL";
export const STOP_HAD_PID_TOKEN = "FORGE_STOP_HAD_PID";
export const STOP_NO_PID_TOKEN = "FORGE_STOP_NO_PID";

export async function persistExternalJobPid(options: {
  pidFile: string;
  pid: number | undefined;
}): Promise<boolean> {
  const pid = options.pid;
  if (pid == null || !Number.isFinite(pid) || pid <= 0) return false;
  await fs.mkdir(path.dirname(options.pidFile), { recursive: true });
  await fs.writeFile(options.pidFile, `${Math.floor(pid)}\n`);
  return true;
}

export function stopJobScript(pidFile: string): string {
  return `
P=$(cat "${pidFile}" 2>/dev/null)
if [ -n "$P" ]; then
  kill -TERM -"$P" 2>/dev/null
  kill -TERM "$P" 2>/dev/null
  if command -v pkill >/dev/null 2>&1; then
    pkill -TERM -P "$P" 2>/dev/null
  fi
  sleep 0.2
  kill -KILL -"$P" 2>/dev/null
  kill -KILL "$P" 2>/dev/null
  if command -v pkill >/dev/null 2>&1; then
    pkill -KILL -P "$P" 2>/dev/null
  fi
  rm -f "${pidFile}"
  printf '%s\\n' "${STOP_HAD_PID_TOKEN}"
else
  rm -f "${pidFile}"
  printf '%s\\n' "${STOP_NO_PID_TOKEN}"
fi
`.trim();
}

export function stopJobHadPid(stdout: string): boolean {
  return stdout.includes(STOP_HAD_PID_TOKEN);
}
