import { randomBytes } from "node:crypto";
import path from "node:path";
import { spawn as nodePtySpawn, type IPty } from "node-pty";
import { extraWritableRootsForHostRoot } from "./sandboxRuntime/hostAdapter.js";
import { resolveWrappedArgv } from "./sandboxRuntime/osSandbox.js";
import { hostProcessEnv } from "./sandboxRuntime/hostEnv.js";

export type HostShellWindow = {
  windowId: string;
  name: string;
  active: boolean;
};

export type HostPtyAttachHandle = {
  execId: string;
  write: (data: Buffer | string) => void;
  resize: (cols: number, rows: number) => Promise<void>;
  close: () => void;
};

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const N_3 = 3;

type DataListener = (chunk: Buffer) => void;

type HostShellTab = {
  name: string;
  windowId: string;
  pty: IPty;
  listeners: Set<DataListener>;
  exited: boolean;
};

const sessionShells = new Map<string, Map<string, HostShellTab>>();

function shellWindowName(): string {
  return `sh-${randomBytes(N_3).toString("hex")}`;
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

function shellsFor(root: string): Map<string, HostShellTab> {
  let map = sessionShells.get(root);
  if (!map) {
    map = new Map();
    sessionShells.set(root, map);
  }
  return map;
}

function resolveHostShellBin(): string {
  if (process.platform === "win32") {
    return process.env.ComSpec?.trim() || "powershell.exe";
  }
  const shell = process.env.SHELL?.trim();
  if (shell) return shell;
  return "bash";
}

function shellArgv(bin: string): string[] {
  if (process.platform === "win32") {
    return [bin];
  }
  if (path.basename(bin) === "bash" || bin.endsWith("/bash")) {
    return [bin, "-l"];
  }
  return [bin];
}

async function spawnHostShell(options: {
  root: string;
  name: string;
  cols?: number;
  rows?: number;
}): Promise<HostShellTab> {
  const bin = resolveHostShellBin();
  const wrapped = await resolveWrappedArgv({
    argv: shellArgv(bin),
    sessionRoot: options.root,
    cwd: options.root,
    extraWritableRoots: extraWritableRootsForHostRoot(options.root)
  });
  const file = wrapped[0]!;
  const args = wrapped.slice(1);
  const env = (await hostProcessEnv(options.root)) as Record<string, string>;
  const pty = nodePtySpawn(file, args, {
    name: "xterm-256color",
    cols: options.cols ?? DEFAULT_COLS,
    rows: options.rows ?? DEFAULT_ROWS,
    cwd: options.root,
    env
  });
  const tab: HostShellTab = {
    name: options.name,
    windowId: String(pty.pid),
    pty,
    listeners: new Set(),
    exited: false
  };
  pty.onData((data) => {
    const buf = Buffer.from(data);
    for (const listener of tab.listeners) {
      listener(buf);
    }
  });
  pty.onExit(() => {
    tab.exited = true;
    const map = sessionShells.get(options.root);
    map?.delete(options.name);
    if (map && map.size === 0) {
      sessionShells.delete(options.root);
    }
  });
  shellsFor(options.root).set(options.name, tab);
  return tab;
}

export async function ensureHostShellSession(root: string): Promise<void> {
  const map = shellsFor(root);
  if (map.size > 0) return;
  await spawnHostShell({ root, name: "main" });
}

export async function listHostShellWindows(
  root: string
): Promise<HostShellWindow[]> {
  await ensureHostShellSession(root);
  const map = shellsFor(root);
  const windows: HostShellWindow[] = [];
  let first = true;
  for (const tab of map.values()) {
    if (tab.exited) continue;
    windows.push({
      windowId: tab.windowId,
      name: tab.name,
      active: first
    });
    first = false;
  }
  return windows;
}

export async function newHostShellWindow(
  root: string,
  name?: string
): Promise<string> {
  await ensureHostShellSession(root);
  const windowName = name ? assertValidWindowName(name) : shellWindowName();
  const map = shellsFor(root);
  if (map.has(windowName)) {
    throw new Error(`Shell tab already exists: ${windowName}`);
  }
  await spawnHostShell({ root, name: windowName });
  return windowName;
}

export async function killHostShellWindow(
  root: string,
  windowName: string
): Promise<void> {
  const map = shellsFor(root);
  if (windowName === "main") {
    const alive = [...map.values()].filter((t) => !t.exited);
    if (alive.length <= 1) {
      throw new Error("Cannot close the last shell tab");
    }
  }
  const tab = map.get(windowName);
  if (!tab) {
    throw new Error(`Shell tab not found: ${windowName}`);
  }
  try {
    tab.pty.kill();
  } catch {
    void 0;
  }
  map.delete(windowName);
  if (map.size === 0) {
    sessionShells.delete(root);
  }
}

export async function attachHostShellWindow(options: {
  root: string;
  windowName: string;
  cols: number;
  rows: number;
  onData: (chunk: Buffer) => void;
  onClose: (code: number | null) => void;
}): Promise<HostPtyAttachHandle> {
  await ensureHostShellSession(options.root);
  const map = shellsFor(options.root);
  let tab = map.get(options.windowName);
  if (!tab || tab.exited) {
    if (options.windowName === "main") {
      tab = await spawnHostShell({
        root: options.root,
        name: "main",
        cols: options.cols,
        rows: options.rows
      });
    } else {
      throw new Error(`Shell tab not found: ${options.windowName}`);
    }
  }
  try {
    tab.pty.resize(options.cols, options.rows);
  } catch {
    void 0;
  }
  const listener: DataListener = options.onData;
  tab.listeners.add(listener);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    tab?.listeners.delete(listener);
    options.onClose(null);
  };
  return {
    execId: `host-pty-${tab.windowId}`,
    write: (data) => {
      if (closed || !tab || tab.exited) return;
      tab.pty.write(typeof data === "string" ? data : data.toString("utf8"));
    },
    resize: async (cols, rows) => {
      if (closed || !tab || tab.exited) return;
      try {
        tab.pty.resize(cols, rows);
      } catch {
        void 0;
      }
    },
    close
  };
}

export function destroyHostShells(root: string): void {
  const map = sessionShells.get(root);
  if (!map) return;
  for (const tab of map.values()) {
    try {
      tab.pty.kill();
    } catch {
      void 0;
    }
  }
  sessionShells.delete(root);
}

export function resetHostShellRegistryForTests(): void {
  for (const root of [...sessionShells.keys()]) {
    destroyHostShells(root);
  }
}
