import { randomBytes } from "node:crypto";
import { dockerExec } from "./sandboxExec.js";
import { dockerExecAttach, type DockerExecAttach } from "./dockerExecHttp.js";
import { WORKSPACE_MOUNT } from "./sessionSandbox/constants.js";

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

async function ensureTmuxAvailable(container: string): Promise<void> {
  if (tmuxReadyContainers.has(container)) return;
  const result = await dockerExec({
    container,
    argv: [
      "sh",
      "-c",
      "command -v tmux >/dev/null 2>&1 || exit 127"
    ]
  });
  if (result.code !== 0) {
    throw new Error(TMUX_REBUILD_MESSAGE);
  }
  tmuxReadyContainers.add(container);
}

export async function ensureTmuxSession(
  container: string,
  cwd = WORKSPACE_MOUNT
): Promise<void> {
  await ensureTmuxAvailable(container);
  await dockerExec({
    container,
    argv: [
      "sh",
      "-c",
      `tmux has-session -t ${TMUX_SESSION} 2>/dev/null || tmux new-session -d -s ${TMUX_SESSION} -c ${cwd} -n main bash -l`
    ]
  });
}

export async function listTmuxWindows(container: string): Promise<TmuxWindow[]> {
  await ensureTmuxSession(container);
  const result = await dockerExec({
    container,
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

export async function newShellWindow(
  container: string,
  name?: string
): Promise<string> {
  await ensureTmuxSession(container);
  const windowName = name ? assertValidWindowName(name) : shellWindowName();
  const result = await dockerExec({
    container,
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

export async function killShellWindow(
  container: string,
  windowName: string
): Promise<void> {
  if (windowName === "main") {
    const windows = await listTmuxWindows(container);
    if (windows.length <= 1) {
      throw new Error("Cannot close the last shell tab");
    }
  }
  const result = await dockerExec({
    container,
    argv: ["tmux", "kill-window", "-t", `${TMUX_SESSION}:${windowName}`]
  });
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "tmux kill-window failed");
  }
}

export type PtyAttachHandle = DockerExecAttach;

export async function attachShellWindow(options: {
  container: string;
  windowName: string;
  cols: number;
  rows: number;
  onData: (chunk: Buffer) => void;
  onClose: (code: number | null) => void;
}): Promise<PtyAttachHandle> {
  await ensureTmuxSession(options.container);
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
