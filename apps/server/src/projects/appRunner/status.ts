import { FIRST_APP_PORT, hostPortForContainerPort } from "../sessionSandbox.js";
import {
  previewUrlForHostname,
  sessionPreviewHostname,
  sessionPreviewHostnameForPort
} from "../sandboxRuntime/hostnames.js";
import {
  isBackgroundJobRunning,
  readBackgroundJobLogs,
  stopBackgroundJob
} from "../backgroundJob.js";
import type {
  ForgeApp,
  AppStatus,
  AppStartFailure,
  LaunchConfigSource
} from "./types.js";
import { ctx, readForgeConfig } from "./config.js";
import { runApp } from "./run.js";

const N_800 = 800;

export async function stopApp(sessionId: string, name: string): Promise<void> {
  const { containerName } = await ctx(sessionId);
  await stopBackgroundJob({ containerName, kind: "app", name });
}
export async function appLogs(options: {
  sessionId: string;
  name: string;
  tail?: number;
}): Promise<string> {
  const { sessionId, name, tail = 300 } = options;
  const { containerName } = await ctx(sessionId);
  return readBackgroundJobLogs({
    containerName,
    kind: "app",
    name,
    tail
  });
}
export async function appLogsForSession(
  sessionId: string,
  tail = 300
): Promise<Record<string, string>> {
  const { config } = await readForgeConfig(sessionId);
  const entries = await Promise.all(
    config.apps.map(async (app) => {
      try {
        const text = await appLogs({ sessionId, name: app.name, tail });
        return [app.name, text] as const;
      } catch {
        return [app.name, ""] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}
function previewProxyConfigured(): boolean {
  return Boolean(
    process.env.FORGE_PREVIEW_BASE_DOMAIN?.trim() ||
    process.env.PREVIEW_PLANE_URL?.trim() ||
    process.env.PREVIEW_PUBLIC_ORIGIN?.trim()
  );
}

function previewUrlIfConfigured(
  sessionId: string,
  port?: number
): string | undefined {
  if (port == null || !previewProxyConfigured()) {
    return undefined;
  }
  const hostname =
    port === FIRST_APP_PORT
      ? sessionPreviewHostname(sessionId)
      : sessionPreviewHostnameForPort(sessionId, port);
  const scheme = process.env.PREVIEW_URL_SCHEME?.trim() || "http";
  return previewUrlForHostname(hostname, scheme);
}

export function resolveRunningAppUrl(options: {
  running: boolean;
  sessionId: string;
  port?: number;
  hostPort?: number | null;
}): string | undefined {
  if (!options.running) return undefined;
  const previewUrl = previewUrlIfConfigured(options.sessionId, options.port);
  const localUrl = options.hostPort
    ? `http://127.0.0.1:${options.hostPort}`
    : undefined;
  return previewUrl ?? localUrl;
}

const PLANE_HEALTH_TTL_MS = 3000;
const PREVIEW_REREGISTER_MS = 15000;
let planeHealthyCache: { at: number; ok: boolean } | null = null;
const lastPreviewPublishAt = new Map<string, number>();

async function isPreviewPlaneHealthy(): Promise<boolean> {
  const base = process.env.PREVIEW_PLANE_URL?.trim()?.replace(/\/$/, "");
  if (!base) return false;
  const now = Date.now();
  if (planeHealthyCache && now - planeHealthyCache.at < PLANE_HEALTH_TTL_MS) {
    return planeHealthyCache.ok;
  }
  try {
    const res = await fetch(`${base}/healthz`, {
      signal: AbortSignal.timeout(N_800)
    });
    const ok = res.ok;
    planeHealthyCache = { at: now, ok };
    return ok;
  } catch {
    planeHealthyCache = { at: now, ok: false };
    return false;
  }
}

async function ensurePreviewPublished(options: {
  sessionId: string;
  containerName: string;
  port: number;
}): Promise<void> {
  const key = `${options.sessionId}:${options.port}`;
  const now = Date.now();
  const last = lastPreviewPublishAt.get(key) ?? 0;
  if (now - last < PREVIEW_REREGISTER_MS) return;
  lastPreviewPublishAt.set(key, now);
  await (await import("./run.js")).publishAppPreview(options).catch(() => {
    lastPreviewPublishAt.delete(key);
  });
}

export async function statusForApp(options: {
  sessionId: string;
  app: ForgeApp;
  containerName: string;
  startFailure?: AppStartFailure;
}): Promise<AppStatus> {
  const { sessionId, app, containerName, startFailure } = options;
  const running = await isBackgroundJobRunning({
    containerName,
    kind: "app",
    name: app.name
  });
  const hostPort =
    app.port != null ? hostPortForContainerPort(sessionId, app.port) : null;
  if (running && app.port != null && previewProxyConfigured()) {
    await ensurePreviewPublished({
      sessionId,
      containerName,
      port: app.port
    });
  }
  let url = resolveRunningAppUrl({
    running,
    sessionId,
    port: app.port,
    hostPort
  });

  if (
    running &&
    url &&
    previewProxyConfigured() &&
    !(await isPreviewPlaneHealthy())
  ) {
    url = hostPort ? `http://127.0.0.1:${hostPort}` : undefined;
  }
  return {
    ...app,
    running,
    hostPort: hostPort ?? undefined,
    url,
    ...(startFailure ? { startFailure } : {})
  };
}
export async function listAppStatuses(sessionId: string): Promise<{
  exists: boolean;
  source: LaunchConfigSource;
  apps: AppStatus[];
}> {
  const { exists, source, config } = await readForgeConfig(sessionId);
  const { containerName } = await ctx(sessionId);
  const apps = await Promise.all(
    config.apps.map((a) => statusForApp({ sessionId, app: a, containerName }))
  );
  void import("../sessionActivity.js")
    .then(({ touchSessionActivity }) => touchSessionActivity(sessionId))
    .catch(() => undefined);
  return { exists, source, apps };
}

export async function listAppRunningFlags(
  sessionId: string
): Promise<Array<{ name: string; running: boolean }>> {
  const { config } = await readForgeConfig(sessionId);
  if (config.apps.length === 0) return [];
  const { containerName } = await ctx(sessionId);
  const { pathExistsInSandbox } = await import("../sandboxExec.js");
  const { jobLogFile } = await import("../backgroundJob.js");
  const flags = await Promise.all(
    config.apps.map(async (app) => {
      const running = await isBackgroundJobRunning({
        containerName,
        kind: "app",
        name: app.name
      });
      if (running) return { name: app.name, running: true };
      const hasLog = await pathExistsInSandbox(
        containerName,
        jobLogFile({ kind: "app", name: app.name })
      );
      return hasLog ? { name: app.name, running: false } : null;
    })
  );
  return flags.filter(
    (f): f is { name: string; running: boolean } => f != null
  );
}

export async function autoStartPreview(sessionId: string): Promise<void> {
  try {
    const { apps } = await listAppStatuses(sessionId);
    if (apps.length === 0) return;

    let ordered = apps;
    try {
      const { loadWorkspaceSessionContext } =
        await import("../../services/workspace/workspaceSession.js");
      const { topoSortRepoNames } =
        await import("../../services/workspace/workspaceWiring.js");
      const ctxWs = await loadWorkspaceSessionContext(sessionId);
      if (ctxWs && ctxWs.members.length > 0) {
        const order = topoSortRepoNames(
          ctxWs.members.map((m) => ({
            repoName: m.repoName,
            dependsOn: m.dependsOn ?? []
          }))
        );
        ordered = order.flatMap((repo) => apps.filter((a) => a.repo === repo));

        const seen = new Set(ordered.map((a) => a.name));
        for (const a of apps) {
          if (!seen.has(a.name)) ordered.push(a);
        }
      }
    } catch {
      void 0;
    }

    const isWorkspace = ordered.some((a) => a.repo);
    for (const app of ordered) {
      const isWeb = app.type == null || app.type === "web";
      const isApi = app.type === "api";

      if (isWorkspace) {
        if (!isWeb && !isApi) continue;
      } else if (!isWeb) {
        continue;
      }
      if (app.running) continue;
      try {
        await runApp(sessionId, app.name);
      } catch (err) {
        console.warn(
          `[autoStartPreview] session ${sessionId} app ${app.name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    await registerWorkspaceGateway(sessionId).catch((err) => {
      console.warn(
        `[autoStartPreview] gateway register ${sessionId}: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  } catch (err) {
    console.warn(
      `[autoStartPreview] session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function registerWorkspaceGateway(
  sessionId: string
): Promise<void> {
  const { loadWorkspaceSessionContext } =
    await import("../../services/workspace/workspaceSession.js");
  const { registerPreviewRoute } =
    await import("../../preview/previewPlaneClient.js");
  const ctxWs = await loadWorkspaceSessionContext(sessionId);
  if (!ctxWs || ctxWs.routes.length === 0) return;

  const { apps } = await listAppStatuses(sessionId);
  const hostByRepo = new Map<string, number>();
  for (const app of apps) {
    if (!app.repo || !app.running || app.hostPort == null) continue;
    if (!hostByRepo.has(app.repo)) hostByRepo.set(app.repo, app.hostPort);
  }
  if (hostByRepo.size === 0) return;

  const pathRoutes: Array<{
    pathPrefix: string;
    backendService: string;
    stripPrefix?: boolean;
  }> = [];
  for (const route of ctxWs.routes) {
    const hostPort = hostByRepo.get(route.target);
    if (hostPort == null) continue;
    pathRoutes.push({
      pathPrefix: route.pathPrefix,
      backendService: `127.0.0.1:${hostPort}`,
      ...(route.stripPrefix === true ? { stripPrefix: true } : {})
    });
  }
  if (pathRoutes.length === 0) return;

  const catchAll =
    pathRoutes.find((r) => r.pathPrefix === "/") ?? pathRoutes[0];
  await registerPreviewRoute({
    sessionId,
    port: FIRST_APP_PORT,
    backendService: catchAll.backendService,
    pathRoutes
  });
}
