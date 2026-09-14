import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { ChatTurnRepository } from "../catalog/sessionChatRepository.js";
import { sandboxContainerName } from "./sessionSandbox/constants.js";
import { docker } from "./sessionSandbox/container.js";

const N_30 = 30;
const N_60 = 60;
const N_1000 = 1000;

export const SANDBOX_IDLE_MS = N_30 * N_60 * N_1000;
export const SANDBOX_IDLE_SWEEP_MS = N_60 * N_1000;

export function sandboxIdleMs(): number {
  const raw = Number(process.env.FORGE_SANDBOX_IDLE_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : SANDBOX_IDLE_MS;
}

export function activityTime(
  value: Date | number | null | undefined
): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const t = value.getTime();
  return Number.isFinite(t) ? t : null;
}

export function laterActivity(
  a: Date | number | null | undefined,
  b: Date | number | null | undefined
): number | null {
  const ta = activityTime(a);
  const tb = activityTime(b);
  if (ta == null) return tb;
  if (tb == null) return ta;
  return Math.max(ta, tb);
}

export function isPastIdleTtl(options: {
  lastActivityAt: Date | number;
  now?: number;
  idleMs?: number;
}): boolean {
  const now = options.now ?? Date.now();
  const idleMs = options.idleMs ?? sandboxIdleMs();
  const t = activityTime(options.lastActivityAt);
  if (t == null) return false;
  return now - t >= idleMs;
}

export async function listRunningSandboxSessionIds(): Promise<string[]> {
  const ids = new Set<string>();
  const { listSessionPortAllocations } =
    await import("./sandboxRuntime/sessionPortRegistry.js");
  for (const row of listSessionPortAllocations()) {
    ids.add(row.sessionId);
  }
  try {
    const { listHostActiveSessionIds } =
      await import("./sandboxRuntime/hostAdapter.js");
    for (const id of listHostActiveSessionIds()) {
      ids.add(id);
    }
  } catch {
    void 0;
  }
  try {
    const { stdout } = await docker([
      "ps",
      "--filter",
      "label=forge.sandbox=1",
      "--filter",
      "status=running",
      "--format",
      '{{.Label "forge.session"}}'
    ]);
    for (const line of stdout.split("\n")) {
      const id = line.trim();
      if (id) ids.add(id);
    }
  } catch {
    void 0;
  }
  return [...ids];
}

export async function suspendSessionSandbox(sessionId: string): Promise<void> {
  try {
    const { revokePreviewSession } =
      await import("../preview/previewPlaneClient.js");
    await revokePreviewSession(sessionId);
  } catch (err) {
    console.warn(
      `[sandboxIdle] revoke preview ${sessionId}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const { getSandboxRuntime, isHostSession } =
    await import("./sandboxRuntime/resolve.js");
  if (await isHostSession(sessionId)) {
    await (
      await getSandboxRuntime(sessionId)
    )
      .destroySession(sessionId)
      .catch(() => undefined);
    return;
  }
  await docker(["stop", sandboxContainerName(sessionId)]).catch(
    () => undefined
  );
}

export type IdleSweepDeps = {
  listRunning: () => Promise<string[]>;
  listAgentSessions: () => Promise<Iterable<string>>;
  getLastActivity: (sessionId: string) => Promise<Date | number | null>;
  getStartedAt?: (sessionId: string) => Promise<Date | number | null>;
  suspend: (sessionId: string) => Promise<void>;
  now?: () => number;
  idleMs?: number;
};

export async function sandboxStartedAt(
  sessionId: string
): Promise<Date | null> {
  const { isHostSession } = await import("./sandboxRuntime/resolve.js");
  if (await isHostSession(sessionId)) {
    return null;
  }
  try {
    const { stdout } = await docker([
      "inspect",
      "-f",
      "{{.State.StartedAt}}",
      sandboxContainerName(sessionId)
    ]);
    const t = Date.parse(stdout.trim());
    return Number.isFinite(t) ? new Date(t) : null;
  } catch {
    return null;
  }
}

export async function suspendIdleSandboxes(
  deps: IdleSweepDeps
): Promise<string[]> {
  const now = deps.now?.() ?? Date.now();
  const idleMs = deps.idleMs ?? sandboxIdleMs();
  const running = await deps.listRunning();
  const agentSessions = new Set(await deps.listAgentSessions());
  const stopped: string[] = [];
  for (const sessionId of running) {
    if (agentSessions.has(sessionId)) continue;
    const last = laterActivity(
      await deps.getLastActivity(sessionId),
      deps.getStartedAt ? await deps.getStartedAt(sessionId) : null
    );
    if (last == null || !isPastIdleTtl({ lastActivityAt: last, now, idleMs }))
      continue;
    await deps.suspend(sessionId);
    stopped.push(sessionId);
  }
  return stopped;
}

export async function sweepIdleSandboxes(): Promise<string[]> {
  const turns = new ChatTurnRepository();
  const chats = new ChatFeatureRepository();
  return suspendIdleSandboxes({
    listRunning: listRunningSandboxSessionIds,
    listAgentSessions: () => turns.listRunningSessionIds(),
    getLastActivity: async (sessionId) => {
      const chat = await chats.getBySessionId(sessionId);
      return chat?.lastActivityAt ?? chat?.createdAt ?? null;
    },
    getStartedAt: sandboxStartedAt,
    suspend: suspendSessionSandbox
  });
}

export function startSandboxIdleSweeper(): () => void {
  const tick = () => {
    void sweepIdleSandboxes()
      .then((stopped) => {
        if (stopped.length === 0) return;
        process.stdout.write(
          `[sandboxIdle] stopped ${stopped.length} idle sandbox(es)\n`
        );
      })
      .catch((err) => {
        console.warn(
          `[sandboxIdle] sweep failed: ${err instanceof Error ? err.message : String(err)}`
        );
      });
  };
  tick();
  const id = setInterval(tick, SANDBOX_IDLE_SWEEP_MS);
  return () => clearInterval(id);
}
