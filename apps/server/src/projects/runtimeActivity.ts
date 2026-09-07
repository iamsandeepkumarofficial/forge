import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { listAppStatuses, stopApp } from "./appRunner.js";
import {
  destroySessionSandbox,
  getSessionSandboxStatus
} from "./sessionSandbox.js";
import { listRunningSandboxSessionIds } from "./sandboxIdle.js";
import {
  listSessionPortAllocations,
  loadSessionPortRegistry,
  type SessionPortAllocation
} from "./sandboxRuntime/sessionPortRegistry.js";
import { resolveSandboxRuntimeKind } from "./sandboxRuntime/resolve.js";
import type { SandboxRuntimeKind } from "./sandboxRuntime/types.js";

export type RuntimeActivitySession = {
  sessionId: string;
  chatId?: string;
  projectId?: string | null;
  workspaceId?: string | null;
  title: string;
  status: string;
  running: boolean;
  runtime: SandboxRuntimeKind;
};

export type RuntimeActivityApp = {
  sessionId: string;
  name: string;
  previewUrl?: string;
  hostPort?: number;
  running: boolean;
};

export type RuntimeActivity = {
  runtimeKind: SandboxRuntimeKind;
  sessions: RuntimeActivitySession[];
  apps: RuntimeActivityApp[];
  ports: SessionPortAllocation[];
};

async function discoverSessionIds(): Promise<string[]> {
  await loadSessionPortRegistry().catch(() => undefined);
  const ids = new Set<string>();
  for (const row of listSessionPortAllocations()) {
    ids.add(row.sessionId);
  }
  for (const id of await listRunningSandboxSessionIds()) {
    ids.add(id);
  }
  if (resolveSandboxRuntimeKind() === "host") {
    const { listHostActiveSessionIds } =
      await import("./sandboxRuntime/hostAdapter.js");
    for (const id of listHostActiveSessionIds()) {
      ids.add(id);
    }
  }
  return [...ids].sort();
}

export async function collectRuntimeActivity(): Promise<RuntimeActivity> {
  const runtimeKind = resolveSandboxRuntimeKind();
  const sessionIds = await discoverSessionIds();
  const chatRepo = new ChatFeatureRepository();
  const sessions: RuntimeActivitySession[] = [];
  const apps: RuntimeActivityApp[] = [];

  for (const sessionId of sessionIds) {
    const chat = await chatRepo.getBySessionId(sessionId).catch(() => null);
    let status = "absent";
    let running = false;
    try {
      const st = await getSessionSandboxStatus(sessionId);
      status = st.status;
      running = st.running;
    } catch {
      void 0;
    }
    sessions.push({
      sessionId,
      chatId: chat?.id,
      projectId: chat?.projectId ?? null,
      workspaceId: chat?.workspaceId ?? null,
      title: chat?.title?.trim() || sessionId,
      status,
      running,
      runtime: runtimeKind
    });
    try {
      const listed = await listAppStatuses(sessionId);
      for (const app of listed.apps) {
        if (!app.running && !app.url) continue;
        apps.push({
          sessionId,
          name: app.name,
          previewUrl: app.url,
          hostPort: app.hostPort,
          running: app.running
        });
      }
    } catch {
      void 0;
    }
  }

  return {
    runtimeKind,
    sessions,
    apps,
    ports: listSessionPortAllocations()
  };
}

export async function stopRuntimeSession(sessionId: string): Promise<void> {
  await destroySessionSandbox(sessionId);
}

export async function stopRuntimeApp(options: {
  sessionId: string;
  name: string;
}): Promise<void> {
  await stopApp(options.sessionId, options.name);
}
