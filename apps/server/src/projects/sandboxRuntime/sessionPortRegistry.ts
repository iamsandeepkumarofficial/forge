import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { resolveSessionsRoot } from "../../services/project/projectsRoot.js";

export const HOST_PORT_FLOOR = 40_000;
export const HOST_PORT_CEILING = 49_999;
const N_100 = 100;

export function isHostRegistryPort(port: number): boolean {
  return (
    Number.isInteger(port) &&
    port >= HOST_PORT_FLOOR &&
    port <= HOST_PORT_CEILING
  );
}

export function hostPublishedAppPortsEnv(): string {
  return `${HOST_PORT_FLOOR}-${HOST_PORT_CEILING}`;
}

export type SessionPortAllocation = {
  sessionId: string;
  ports: number[];
};

type RegistryState = {
  bySession: Map<string, Set<number>>;
  used: Set<number>;
};

const state: RegistryState = {
  bySession: new Map(),
  used: new Set()
};

function registryFilePath(): string {
  return path.join(resolveSessionsRoot(), ".port-registry.json");
}

async function canBind(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export function listSessionPortAllocations(): SessionPortAllocation[] {
  return [...state.bySession.entries()].map(([sessionId, ports]) => ({
    sessionId,
    ports: [...ports].sort((a, b) => a - b)
  }));
}

export function portsForSession(sessionId: string): number[] {
  const set = state.bySession.get(sessionId);
  return set ? [...set].sort((a, b) => a - b) : [];
}

export async function allocateSessionPort(
  sessionId: string,
  preferred?: number
): Promise<number> {
  const existing = state.bySession.get(sessionId);
  if (
    preferred != null &&
    isHostRegistryPort(preferred) &&
    existing?.has(preferred)
  ) {
    return preferred;
  }
  const candidates: number[] = [];
  if (preferred != null && isHostRegistryPort(preferred)) {
    candidates.push(preferred);
  }
  for (let p = HOST_PORT_FLOOR; p <= HOST_PORT_CEILING; p++) {
    if (!state.used.has(p)) candidates.push(p);
    if (candidates.length >= N_100) break;
  }
  for (const port of candidates) {
    if (state.used.has(port)) continue;
    if (!(await canBind(port))) continue;
    let set = state.bySession.get(sessionId);
    if (!set) {
      set = new Set();
      state.bySession.set(sessionId, set);
    }
    set.add(port);
    state.used.add(port);
    await persistRegistry().catch(() => undefined);
    return port;
  }
  throw new Error(
    `No free Forge host port in ${HOST_PORT_FLOOR}–${HOST_PORT_CEILING}`
  );
}

export async function releaseSessionPorts(sessionId: string): Promise<void> {
  const set = state.bySession.get(sessionId);
  if (!set) return;
  for (const port of set) state.used.delete(port);
  state.bySession.delete(sessionId);
  await persistRegistry().catch(() => undefined);
}

export async function releaseSessionPort(
  sessionId: string,
  port: number
): Promise<void> {
  const set = state.bySession.get(sessionId);
  if (!set) return;
  set.delete(port);
  state.used.delete(port);
  if (set.size === 0) state.bySession.delete(sessionId);
  await persistRegistry().catch(() => undefined);
}

async function persistRegistry(): Promise<void> {
  const root = resolveSessionsRoot();
  await fs.mkdir(root, { recursive: true });
  const payload = {
    sessions: Object.fromEntries(
      [...state.bySession.entries()].map(([id, ports]) => [id, [...ports]])
    )
  };
  await fs.writeFile(registryFilePath(), JSON.stringify(payload, null, 2));
}

export async function loadSessionPortRegistry(): Promise<void> {
  try {
    const raw = await fs.readFile(registryFilePath(), "utf8");
    const parsed = JSON.parse(raw) as { sessions?: Record<string, number[]> };
    state.bySession.clear();
    state.used.clear();
    for (const [sessionId, ports] of Object.entries(parsed.sessions ?? {})) {
      const set = new Set(ports.filter((p) => Number.isInteger(p)));
      if (set.size === 0) continue;
      state.bySession.set(sessionId, set);
      for (const p of set) state.used.add(p);
    }
  } catch {
    void 0;
  }
}

export function resetSessionPortRegistryForTests(): void {
  state.bySession.clear();
  state.used.clear();
}
