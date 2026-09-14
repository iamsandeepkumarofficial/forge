import { randomBytes } from "node:crypto";
import { dockerExec } from "./sandboxExec.js";
import { dockerExecAttach, type DockerExecAttach } from "./dockerExecHttp.js";
import { WORKSPACE_MOUNT } from "./sessionSandbox/constants.js";
import { isHostSession } from "./sandboxRuntime/resolve.js";

export const TMUX_SESSION = "forge";
export const TMUX_REBUILD_MESSAGE =
  "tmux is not installed in the sandbox image. Rebuild with: pnpm docker:sandbox";

export type TmuxWindow = {
  windowId: string;
  name: string;
  active: boolean;
};

export function parseTmuxWindowLine(line: string): TmuxWindow | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length < 2) return null;
  const active = parts.pop();
  const windowId = parts.shift();
  const name = parts.join(":");
  if (!windowId || !name || active === undefined) return null;
  return {
    windowId,
    name,
    active: active === "1"
  };
}

export function parseTmuxWindowList(stdout: string): TmuxWindow[] {
  const windows: TmuxWindow[] = [];
  for (const line of stdout.split("\n")) {
    const parsed = parseTmuxWindowLine(line);
    if (parsed) windows.push(parsed);
  }
  return windows;
}

function shellWindowName(): string {
  return `sh-${randomBytes(3).toString("hex")}`;
}

function assertValidWindowName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Shell tab name required");
  }
  if (trimmed.includes(":")) {
    throw new Error("Shell tab name cannot contain ':'");
  }
  return trimmed;
}

const tmuxReadyContainers = new Set<string>();

async function ensureTmuxAvailable(
  container: string,
  sessionId: string
): Promise<void> {
  if (tmuxReadyContainers.has(container)) return;
  const result = await dockerExec({
    container,
    sessionId,
    argv: ["sh", "-c", "command -v tmux >/dev/null 2>&1 || exit 127"]
  });
  if (result.code !== 0) {
    throw new Error(TMUX_REBUILD_MESSAGE);
  }
  tmuxReadyContainers.add(container);
}

export async function ensureTmuxSession(options: {
  container: string;
  sessionId: string;
  cwd?: string;
}): Promise<void> {
  const { container, sessionId } = options;
  const cwd = options.cwd ?? WORKSPACE_MOUNT;
  if (await isHostSession(sessionId)) {
    const { ensureHostShellSession } = await import("./hostSessionPty.js");
    await ensureHostShellSession(container);
    return;
  }
  await ensureTmuxAvailable(container, sessionId);
  await dockerExec({
    container,
    sessionId,
    argv: [
      "sh",
      "-c",
      `tmux has-session -t ${TMUX_SESSION} 2>/dev/null || tmux new-session -d -s ${TMUX_SESSION} -c ${cwd} -n main bash -l`
    ]
  });
}

export async function listTmuxWindows(
  container: string,
  sessionId: string
): Promise<TmuxWindow[]> {
  if (await isHostSession(sessionId)) {
    const { listHostShellWindows } = await import("./hostSessionPty.js");
    return listHostShellWindows(container);
  }
  await ensureTmuxSession({ container, sessionId });
  const result = await dockerExec({
    container,
    sessionId,
    argv: [
      "tmux",
      "list-windows",
      "-t",
      TMUX_SESSION,
      "-F",
      "#{window_id}:#{window_name}:#{window_active}"
    ]
  });
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "tmux list-windows failed");
  }
  return parseTmuxWindowList(result.stdout);
}

export async function newShellWindow(options: {
  container: string;
  sessionId: string;
  name?: string;
}): Promise<string> {
  const { container, sessionId, name } = options;
  if (await isHostSession(sessionId)) {
    const { newHostShellWindow } = await import("./hostSessionPty.js");
    return newHostShellWindow(container, name);
  }
  await ensureTmuxSession({ container, sessionId });
  const windowName = name ? assertValidWindowName(name) : shellWindowName();
  const result = await dockerExec({
    container,
    sessionId,
    argv: [
      "tmux",
      "new-window",
      "-t",
      TMUX_SESSION,
      "-n",
      windowName,
      "-c",
      WORKSPACE_MOUNT,
      "bash",
      "-l"
    ]
  });
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "tmux new-window failed");
  }
  return windowName;
}

export async function killShellWindow(options: {
  container: string;
  sessionId: string;
  windowName: string;
}): Promise<void> {
  const { container, sessionId, windowName } = options;
  if (await isHostSession(sessionId)) {
    const { killHostShellWindow } = await import("./hostSessionPty.js");
    await killHostShellWindow(container, windowName);
    return;
  }
  if (windowName === "main") {
    const windows = await listTmuxWindows(container, sessionId);
    if (windows.length <= 1) {
      throw new Error("Cannot close the last shell tab");
    }
  }
  const result = await dockerExec({
    container,
    sessionId,
    argv: ["tmux", "kill-window", "-t", `${TMUX_SESSION}:${windowName}`]
  });
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "tmux kill-window failed");
  }
}

export type PtyAttachHandle = DockerExecAttach;

export async function attachShellWindow(options: {
  container: string;
  sessionId: string;
  windowName: string;
  cols: number;
  rows: number;
  onData: (chunk: Buffer) => void;
  onClose: (code: number | null) => void;
}): Promise<PtyAttachHandle> {
  if (await isHostSession(options.sessionId)) {
    const { attachHostShellWindow } = await import("./hostSessionPty.js");
    return attachHostShellWindow({
      root: options.container,
      windowName: options.windowName,
      cols: options.cols,
      rows: options.rows,
      onData: options.onData,
      onClose: options.onClose
    });
  }
  await ensureTmuxSession({
    container: options.container,
    sessionId: options.sessionId
  });
  return dockerExecAttach({
    container: options.container,
    cmd: [
      "tmux",
      "attach-session",
      "-d",
      "-t",
      `${TMUX_SESSION}:${options.windowName}`
    ],
    cwd: WORKSPACE_MOUNT,
    cols: options.cols,
    rows: options.rows,
    onData: options.onData,
    onClose: options.onClose
  });
}
