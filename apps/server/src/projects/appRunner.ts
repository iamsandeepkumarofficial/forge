import {
  resolveSandbox,
  readFileFromSandbox,
  writeFileToSandbox
} from "./sandboxExec.js";
import {
  allocateReservedAppPort,
  hostPortForContainerPort,
  FIRST_APP_PORT,
  isReservedAppPort,
  LAST_APP_PORT,
  sessionHostPortBase
} from "./sessionSandbox.js";
import {
  previewUrlForHostname,
  sessionPreviewHostname,
  sessionPreviewHostnameForPort
} from "./sandboxRuntime/hostnames.js";
import {
  isBackgroundJobRunning,
  readBackgroundJobLogs,
  startBackgroundJob,
  stopBackgroundJob,
  waitUntilHostTcpListening,
  waitUntilJobRunning,
  waitUntilTcpListening
} from "./backgroundJob.js";
import { normalizeLaunchCwd, resolveLaunchAppDir } from "./launchCwd.js";

export type AppType = "web" | "api" | "worker";
export interface ForgeApp {
  name: string;
  cwd: string;
  command: string;
  port?: number;
  type: AppType;
}
export interface ForgeConfig {
  apps: ForgeApp[];
}
export type AppStartFailure = "process" | "port";
export interface AppStatus extends ForgeApp {
  running: boolean;
  url?: string;
  hostPort?: number;
  startFailure?: AppStartFailure;
}
const LAUNCH_FILE = ".forge/launch.json";
const LEGACY_LAUNCH_FILE = ".pulse/launch.json";
const LEGACY_ROOT_FILE = "pulse.json";
async function ctx(sessionId: string) {
  const { containerName, workingDir, repoDir } =
    await resolveSandbox(sessionId);
  return { containerName, workingDir, repoDir };
}
export type LaunchConfigSource = "launch" | "legacy" | "none";

function parseConfigJson(raw: string | null): ForgeConfig | null {
  if (raw === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ForgeConfig;
    const apps = Array.isArray(parsed.apps) ? parsed.apps : [];
    return { apps };
  } catch {
    return { apps: [] };
  }
}

export async function readForgeConfig(sessionId: string): Promise<{
  exists: boolean;
  source: LaunchConfigSource;
  config: ForgeConfig;
}> {
  const { containerName, workingDir } = await ctx(sessionId);
  const launchRaw = await readFileFromSandbox(
    containerName,
    `${workingDir}/${LAUNCH_FILE}`
  );
  const launchConfig = parseConfigJson(launchRaw);
  if (launchConfig) {
    return { exists: true, source: "launch", config: launchConfig };
  }
  const legacyLaunchRaw = await readFileFromSandbox(
    containerName,
    `${workingDir}/${LEGACY_LAUNCH_FILE}`
  );
  const legacyLaunchConfig = parseConfigJson(legacyLaunchRaw);
  if (legacyLaunchConfig) {
    return { exists: true, source: "legacy", config: legacyLaunchConfig };
  }
  const legacyRaw = await readFileFromSandbox(
    containerName,
    `${workingDir}/${LEGACY_ROOT_FILE}`
  );
  const legacyConfig = parseConfigJson(legacyRaw);
  if (legacyConfig) {
    return { exists: true, source: "legacy", config: legacyConfig };
  }
  return { exists: false, source: "none", config: { apps: [] } };
}
export async function writeForgeConfig(
  sessionId: string,
  config: ForgeConfig
): Promise<void> {
  const { containerName, workingDir } = await ctx(sessionId);
  await writeFileToSandbox({
    container: containerName,
    absPath: `${workingDir}/${LAUNCH_FILE}`,
    content: JSON.stringify(config, null, 2) + "\n"
  });
}

export async function upsertLaunchApp(
  sessionId: string,
  app: ForgeApp
): Promise<ForgeConfig> {
  const { repoDir } = await ctx(sessionId);
  const { config } = await readForgeConfig(sessionId);
  const usedPorts = config.apps
    .filter((a) => a.name !== app.name && a.port != null)
    .map((a) => a.port as number);
  const nextApp: ForgeApp = {
    ...app,
    cwd: normalizeLaunchCwd({ cwd: app.cwd, repoDir }),
    port: normalizeLaunchPort(app.port, usedPorts)
  };
  const nextApps = config.apps.filter((a) => a.name !== nextApp.name);
  nextApps.push(nextApp);
  const next = { apps: nextApps };
  await writeForgeConfig(sessionId, next);
  return next;
}

function normalizeLaunchPort(
  port: number | undefined,
  usedPorts: number[]
): number | undefined {
  if (port == null) return undefined;
  if (isReservedAppPort(port) && !usedPorts.includes(port)) return port;
  return allocateReservedAppPort(usedPorts) ?? FIRST_APP_PORT;
}

async function persistAppPort(options: {
  sessionId: string;
  name: string;
  port: number;
}): Promise<void> {
  const { config } = await readForgeConfig(options.sessionId);
  const nextApps = config.apps.map((a) =>
    a.name === options.name ? { ...a, port: options.port } : a
  );
  await writeForgeConfig(options.sessionId, { apps: nextApps });
}

async function persistAppCwd(options: {
  sessionId: string;
  name: string;
  cwd: string;
}): Promise<void> {
  const { config } = await readForgeConfig(options.sessionId);
  const nextApps = config.apps.map((a) =>
    a.name === options.name ? { ...a, cwd: options.cwd } : a
  );
  await writeForgeConfig(options.sessionId, { apps: nextApps });
}
async function findApp(sessionId: string, name: string): Promise<ForgeApp> {
  const { config } = await readForgeConfig(sessionId);
  const app = config.apps.find((a) => a.name === name);
  if (!app) {
    throw new Error(
      `App not found in .forge/launch.json: ${name}. Use upsert_launch_app, then retry.`
    );
  }
  return app;
}
export async function runApp(
  sessionId: string,
  name: string
): Promise<AppStatus> {
  let app = await findApp(sessionId, name);
  const { containerName, workingDir, repoDir } = await ctx(sessionId);
  if (app.port != null && !isReservedAppPort(app.port)) {
    const { config } = await readForgeConfig(sessionId);
    const usedPorts = config.apps
      .filter((a) => a.name !== app.name && a.port != null)
      .map((a) => a.port as number);
    const remapped = allocateReservedAppPort(usedPorts) ?? FIRST_APP_PORT;
    console.warn(
      `[runApp] session ${sessionId} app ${app.name}: port ${app.port} is outside published range ${FIRST_APP_PORT}–${LAST_APP_PORT}; remapping to ${remapped}`
    );
    await persistAppPort({ sessionId, name: app.name, port: remapped });
    app = { ...app, port: remapped };
  }
  const resolved = await resolveLaunchAppDir({
    containerName,
    workingDir,
    repoDir,
    cwd: app.cwd
  });
  const nextApp: ForgeApp = { ...app, cwd: resolved.relCwd };
  if (resolved.relCwd !== app.cwd) {
    await persistAppCwd({
      sessionId,
      name: app.name,
      cwd: resolved.relCwd
    });
  }
  if (resolved.error) {
    return statusForApp({
      sessionId,
      app: nextApp,
      containerName,
      startFailure: "process"
    });
  }
  const started = await startAppProcess({
    containerName,
    app: nextApp,
    appDir: resolved.appDir
  });
  if (!started.ok) {
    return statusForApp({
      sessionId,
      app: nextApp,
      containerName,
      startFailure: started.failure
    });
  }
  if (app.port != null) {
    const hostPort = hostPortForContainerPort(sessionId, app.port);
    if (hostPort != null) {
      const hostReady = await ensurePreviewHostPort({
        sessionId,
        containerName,
        app: nextApp,
        appDir: resolved.appDir,
        hostPort
      });
      if (!hostReady) {
        await stopBackgroundJob({
          containerName,
          kind: "app",
          name: app.name
        }).catch(() => undefined);
        return statusForApp({
          sessionId,
          app: nextApp,
          containerName,
          startFailure: "port"
        });
      }
    }
    await publishAppPreview({ sessionId, containerName, port: app.port });
  }
  return statusForApp({ sessionId, app: nextApp, containerName });
}

async function startAppProcess(options: {
  containerName: string;
  app: ForgeApp;
  appDir: string;
}): Promise<{ ok: true } | { ok: false; failure: AppStartFailure }> {
  const { containerName, app, appDir } = options;
  await startBackgroundJob({
    containerName,
    kind: "app",
    name: app.name,
    cwd: appDir,
    command: app.command,
    extraEnv: app.port != null ? { PORT: String(app.port) } : undefined
  });
  const running = await waitUntilJobRunning({
    containerName,
    kind: "app",
    name: app.name
  });
  if (!running) return { ok: false, failure: "process" };
  if (app.port == null) return { ok: true };
  const listening = await waitUntilTcpListening({
    containerName,
    port: app.port
  });
  if (!listening) {
    await stopBackgroundJob({
      containerName,
      kind: "app",
      name: app.name
    }).catch(() => undefined);
    return { ok: false, failure: "port" };
  }
  return { ok: true };
}

/** Rebind Docker host ports if Desktop dropped them, then relaunch the app. */
async function ensurePreviewHostPort(options: {
  sessionId: string;
  containerName: string;
  app: ForgeApp;
  appDir: string;
  hostPort: number;
}): Promise<boolean> {
  const { sessionId, containerName, app, appDir, hostPort } = options;
  if (await waitUntilHostTcpListening({ port: hostPort, tries: 8 })) {
    return true;
  }
  console.warn(
    `[runApp] session ${sessionId} app ${app.name}: host port ${hostPort} not reachable; repairing Docker port bindings`
  );
  const { repairHostPortBindings } = await import(
    "./sessionSandbox/container.js"
  );
  await repairHostPortBindings({
    containerName,
    portBase: sessionHostPortBase(sessionId)
  });
  const restarted = await startAppProcess({ containerName, app, appDir });
  if (!restarted.ok) return false;
  return waitUntilHostTcpListening({ port: hostPort, tries: 20 });
}

async function publishAppPreview(input: {
  sessionId: string;
  containerName: string;
  port: number;
}): Promise<void> {
  const { getSandboxRuntime, resolveSandboxRuntimeKind } =
    await import("./sandboxRuntime/resolve.js");
  await getSandboxRuntime().publishPreviewPort(
    {
      sessionId: input.sessionId,
      runtime: resolveSandboxRuntimeKind(),
      ref: input.containerName
    },
    input.port
  );
}
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

/** Prefer proxied preview URL over raw host port when preview domain is configured. */
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
      signal: AbortSignal.timeout(800)
    });
    const ok = res.ok;
    planeHealthyCache = { at: now, ok };
    return ok;
  } catch {
    planeHealthyCache = { at: now, ok: false };
    return false;
  }
}

/** Re-upsert preview routes lost on server restart (throttled). */
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
  await publishAppPreview(options).catch(() => {
    lastPreviewPublishAt.delete(key);
  });
}

async function statusForApp(options: {
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
  // Avoid blank iframe when status advertises a proxy URL but plane is down.
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
  return { exists, source, apps };
}

/** Best-effort: start web apps from launch.json after sandbox provision. Never throws. */
export async function autoStartPreview(sessionId: string): Promise<void> {
  try {
    const { apps } = await listAppStatuses(sessionId);
    if (apps.length === 0) return;
    for (const app of apps) {
      const isWeb = app.type == null || app.type === "web";
      if (!isWeb || app.running) continue;
      try {
        await runApp(sessionId, app.name);
      } catch (err) {
        console.warn(
          `[autoStartPreview] session ${sessionId} app ${app.name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  } catch (err) {
    console.warn(
      `[autoStartPreview] session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
