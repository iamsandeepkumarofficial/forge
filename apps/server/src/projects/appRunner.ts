import {
  resolveSandbox,
  readFileFromSandbox,
  writeFileToSandbox
} from "./sandboxExec.js";
import { hostPortForContainerPort, FIRST_APP_PORT } from "./sessionSandbox.js";
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
  const nextApp: ForgeApp = {
    ...app,
    cwd: normalizeLaunchCwd({ cwd: app.cwd, repoDir })
  };
  const { config } = await readForgeConfig(sessionId);
  const nextApps = config.apps.filter((a) => a.name !== nextApp.name);
  nextApps.push(nextApp);
  const next = { apps: nextApps };
  await writeForgeConfig(sessionId, next);
  return next;
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
  const app = await findApp(sessionId, name);
  const { containerName, workingDir, repoDir } = await ctx(sessionId);
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
  await startBackgroundJob({
    containerName,
    kind: "app",
    name: app.name,
    cwd: resolved.appDir,
    command: app.command,
    extraEnv: app.port != null ? { PORT: String(app.port) } : undefined
  });
  const running = await waitUntilJobRunning({
    containerName,
    kind: "app",
    name: app.name
  });
  if (!running) {
    return statusForApp({
      sessionId,
      app: nextApp,
      containerName,
      startFailure: "process"
    });
  }
  if (app.port != null) {
    const listening = await waitUntilTcpListening({
      containerName,
      port: app.port
    });
    if (!listening) {
      await stopBackgroundJob({
        containerName,
        kind: "app",
        name: app.name
      });
      return statusForApp({
        sessionId,
        app: nextApp,
        containerName,
        startFailure: "port"
      });
    }
    await publishAppPreview({ sessionId, containerName, port: app.port });
  }
  return statusForApp({ sessionId, app: nextApp, containerName });
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
function previewUrlIfConfigured(
  sessionId: string,
  port?: number
): string | undefined {
  if (port == null || !process.env.FORGE_PREVIEW_BASE_DOMAIN?.trim()) {
    return undefined;
  }
  const hostname =
    port === FIRST_APP_PORT
      ? sessionPreviewHostname(sessionId)
      : sessionPreviewHostnameForPort(sessionId, port);
  const scheme = process.env.PREVIEW_URL_SCHEME?.trim() || "http";
  return previewUrlForHostname(hostname, scheme);
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
  const previewUrl = previewUrlIfConfigured(sessionId, app.port);
  const localUrl = hostPort ? `http://127.0.0.1:${hostPort}` : undefined;
  return {
    ...app,
    running,
    hostPort: hostPort ?? undefined,
    url: running ? (previewUrl ?? localUrl) : undefined,
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
