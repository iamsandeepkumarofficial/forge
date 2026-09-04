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
  freeListeningPort,
  waitUntilHostTcpListening,
  waitUntilJobRunning,
  waitUntilTcpListening
} from "./backgroundJob.js";
import { normalizeLaunchCwd, resolveLaunchAppDir, safeRelDir } from "./launchCwd.js";

export type AppType = "web" | "api" | "worker";
export interface ForgeApp {
  name: string;
  cwd: string;
  command: string;
  port?: number;
  type: AppType;
  
  repo?: string;
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
  const { containerName, workingDir, repoDir, worktrees } =
    await resolveSandbox(sessionId);
  return { containerName, workingDir, repoDir, worktrees };
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

function qualifyApp(app: ForgeApp, repo: string): ForgeApp {
  const localCwd = typeof app.cwd === "string" && app.cwd.trim() ? app.cwd : ".";
  const cwd =
    localCwd === "." || localCwd === ""
      ? repo
      : localCwd === repo || localCwd.startsWith(`${repo}/`)
        ? localCwd.replace(/^\.\//, "")
        : `${repo}/${localCwd.replace(/^\.\//, "")}`;
  const name =
    app.name.startsWith(`${repo}/`) ? app.name : `${repo}/${app.name}`;
  return {
    ...app,
    name,
    cwd,
    repo
  };
}


function normalizeWorkspaceRootApp(
  app: ForgeApp,
  memberRepos: string[]
): ForgeApp | null {
  const repo =
    inferWorkspaceRepo({ app, memberRepos }) ??
    (typeof app.repo === "string" && memberRepos.includes(app.repo)
      ? app.repo
      : null);
  if (!repo) return null;
  return qualifyApp({ ...app, repo }, repo);
}

function assertCwdUnderRepo(
  cwd: string,
  repo: string,
  memberRepos: string[]
): string {
  const cleaned = safeRelDir(cwd || ".") || ".";
  if (cleaned === "." || cleaned === repo) return repo;
  if (cleaned.startsWith(`${repo}/`)) return cleaned;
  const first = cleaned.split("/")[0]!;
  if (memberRepos.includes(first) && first !== repo) {
    throw new Error(
      `cwd "${cwd}" belongs to member "${first}", not "${repo}". Use "${repo}" or "${repo}/apps/web".`
    );
  }
  
  return `${repo}/${cleaned.replace(/^\.\//, "")}`;
}

async function readLaunchAt(
  containerName: string,
  mountPath: string
): Promise<{ source: LaunchConfigSource; config: ForgeConfig } | null> {
  const launchRaw = await readFileFromSandbox(
    containerName,
    `${mountPath}/${LAUNCH_FILE}`
  );
  const launchConfig = parseConfigJson(launchRaw);
  if (launchConfig) {
    return { source: "launch", config: launchConfig };
  }
  const legacyLaunchRaw = await readFileFromSandbox(
    containerName,
    `${mountPath}/${LEGACY_LAUNCH_FILE}`
  );
  const legacyLaunchConfig = parseConfigJson(legacyLaunchRaw);
  if (legacyLaunchConfig) {
    return { source: "legacy", config: legacyLaunchConfig };
  }
  const legacyRaw = await readFileFromSandbox(
    containerName,
    `${mountPath}/${LEGACY_ROOT_FILE}`
  );
  const legacyConfig = parseConfigJson(legacyRaw);
  if (legacyConfig) {
    return { source: "legacy", config: legacyConfig };
  }
  return null;
}

export async function readForgeConfig(sessionId: string): Promise<{
  exists: boolean;
  source: LaunchConfigSource;
  config: ForgeConfig;
}> {
  const { containerName, workingDir, worktrees } = await ctx(sessionId);
  const trees = worktrees && Object.keys(worktrees).length > 0 ? worktrees : null;
  const memberRepos = trees ? Object.keys(trees).sort() : [];

  
  if (trees) {
    const rootFound = await readLaunchAt(containerName, workingDir);
    if (!rootFound) {
      return { exists: false, source: "none", config: { apps: [] } };
    }
    const apps: ForgeApp[] = [];
    for (const app of rootFound.config.apps) {
      const normalized = normalizeWorkspaceRootApp(app, memberRepos);
      if (normalized) apps.push(normalized);
    }
    return {
      exists: apps.length > 0 || rootFound.source !== "none",
      source: rootFound.source,
      config: { apps }
    };
  }

  const found = await readLaunchAt(containerName, workingDir);
  if (found) {
    return { exists: true, source: found.source, config: found.config };
  }
  return { exists: false, source: "none", config: { apps: [] } };
}


function toWorkspaceRootApp(
  app: ForgeApp,
  repo: string,
  memberRepos: string[]
): ForgeApp {
  const local = unqualifyApp(app, repo);
  const cwdInput = app.cwd?.startsWith(repo)
    ? app.cwd
    : local.cwd === "."
      ? repo
      : `${repo}/${local.cwd}`;
  const cwd = assertCwdUnderRepo(cwdInput, repo, memberRepos);
  return {
    name: local.name,
    cwd,
    command: app.command,
    type: app.type,
    repo,
    ...(app.port != null ? { port: app.port } : {})
  };
}

export async function writeForgeConfig(
  sessionId: string,
  config: ForgeConfig
): Promise<void> {
  const { containerName, workingDir, worktrees } = await ctx(sessionId);
  const memberRepos = worktrees ? Object.keys(worktrees).sort() : [];
  const isWorkspace = memberRepos.length > 0;

  if (isWorkspace) {
    const rootApps: ForgeApp[] = [];
    for (const app of config.apps) {
      const repo = inferWorkspaceRepo({ app, memberRepos });
      if (!repo) {
        throw new Error(
          `Workspace launch apps require a member repo. Set cwd under a member (e.g. "${memberRepos[0]}") or pass repo. Members: ${memberRepos.join(", ")}`
        );
      }
      rootApps.push(toWorkspaceRootApp({ ...app, repo }, repo, memberRepos));
    }
    await writeFileToSandbox({
      container: containerName,
      absPath: `${workingDir}/${LAUNCH_FILE}`,
      content: JSON.stringify({ apps: rootApps }, null, 2) + "\n"
    });
    return;
  }

  await writeFileToSandbox({
    container: containerName,
    absPath: `${workingDir}/${LAUNCH_FILE}`,
    content: JSON.stringify({ apps: config.apps }, null, 2) + "\n"
  });
}

function unqualifyApp(app: ForgeApp, repo: string): ForgeApp {
  const prefix = `${repo}/`;
  const name = app.name.startsWith(prefix)
    ? app.name.slice(prefix.length)
    : app.name;
  let cwd = app.cwd;
  if (cwd === repo) cwd = ".";
  else if (cwd.startsWith(prefix)) cwd = cwd.slice(prefix.length) || ".";
  const { repo: _r, ...rest } = app;
  return { ...rest, name, cwd };
}


export function inferWorkspaceRepo(options: {
  app: Pick<ForgeApp, "name" | "cwd" | "repo">;
  memberRepos: string[];
}): string | null {
  const members = options.memberRepos;
  if (options.app.repo && members.includes(options.app.repo)) {
    return options.app.repo;
  }
  const cwd = safeRelDir(options.app.cwd || ".") || ".";
  if (cwd !== ".") {
    const first = cwd.split("/")[0]!;
    if (members.includes(first)) return first;
  }
  const nameFirst = options.app.name.split("/")[0]!;
  if (members.includes(nameFirst)) return nameFirst;
  if (members.length === 1) return members[0]!;
  return null;
}

export async function upsertLaunchApp(
  sessionId: string,
  app: ForgeApp
): Promise<ForgeConfig> {
  const { repoDir, worktrees } = await ctx(sessionId);
  const memberRepos = worktrees ? Object.keys(worktrees).sort() : [];
  const isWorkspace = memberRepos.length > 0;

  let nextApp: ForgeApp = { ...app };
  if (isWorkspace) {
    const repo = inferWorkspaceRepo({ app: nextApp, memberRepos });
    if (!repo) {
      throw new Error(
        `Workspace upsert requires a member repo. Set cwd to a member path (e.g. "${memberRepos[0]}") or pass repo. Members: ${memberRepos.join(", ")}`
      );
    }
    const cwd = assertCwdUnderRepo(nextApp.cwd || repo, repo, memberRepos);
    const localName = nextApp.name.startsWith(`${repo}/`)
      ? nextApp.name.slice(repo.length + 1)
      : nextApp.name;
    nextApp = {
      ...nextApp,
      repo,
      name: `${repo}/${localName}`,
      cwd
    };
  } else {
    nextApp = {
      ...nextApp,
      cwd: normalizeLaunchCwd({ cwd: nextApp.cwd, repoDir })
    };
  }

  const { config } = await readForgeConfig(sessionId);
  const localName = nextApp.repo
    ? unqualifyApp(nextApp, nextApp.repo).name
    : nextApp.name;

  const others = config.apps.filter((a) => {
    if (!nextApp.repo) return a.name !== nextApp.name;
    if (a.repo !== nextApp.repo && !a.name.startsWith(`${nextApp.repo}/`)) {
      return true;
    }
    const aLocal = a.repo
      ? unqualifyApp(a, a.repo).name
      : a.name.slice(nextApp.repo.length + 1);
    return aLocal !== localName;
  });
  const existing = config.apps.find((a) => {
    if (!nextApp.repo) return a.name === nextApp.name;
    if (a.repo !== nextApp.repo && !a.name.startsWith(`${nextApp.repo}/`)) {
      return false;
    }
    const aLocal = a.repo
      ? unqualifyApp(a, a.repo).name
      : a.name.slice(nextApp.repo!.length + 1);
    return aLocal === localName;
  });
  const usedPorts = others
    .filter((a) => a.port != null)
    .map((a) => a.port as number);

  
  const portInput =
    nextApp.port == null && existing?.port != null
      ? existing.port
      : nextApp.port;
  nextApp = {
    ...nextApp,
    port: resolveLaunchPort(portInput, usedPorts)
  };

  const nextApps = [...others, nextApp];
  const next = { apps: nextApps };
  await writeForgeConfig(sessionId, next);
  return next;
}

function resolveLaunchPort(
  port: number | undefined,
  usedPorts: number[]
): number | undefined {
  if (port == null) return undefined;
  if (!isReservedAppPort(port)) {
    throw new Error(
      `Port ${port} is outside published range ${FIRST_APP_PORT}–${LAST_APP_PORT}. Use a free port in that range.`
    );
  }
  if (usedPorts.includes(port)) {
    throw new Error(
      `Port ${port} is already used by another app. Choose a free port in ${FIRST_APP_PORT}–${LAST_APP_PORT}.`
    );
  }
  return port;
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
    sessionId,
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
  const status = await statusForApp({ sessionId, app: nextApp, containerName });
  if (status.running) {
    void persistSuccessfulEnvironment(sessionId);
  }
  return status;
}


async function persistSuccessfulEnvironment(sessionId: string): Promise<void> {
  try {
    const {
      promoteLaunchToWorkspace,
      captureWorkspaceDepsForSession
    } = await import("./workspaceEnvironment.js");
    await promoteLaunchToWorkspace(sessionId);
    await captureWorkspaceDepsForSession(sessionId);
  } catch (err) {
    console.warn(
      `[runApp] persist environment ${sessionId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

async function resolveAppExtraEnv(
  sessionId: string,
  app: ForgeApp
): Promise<Record<string, string>> {
  const base: Record<string, string> = {
    HOST: "0.0.0.0",
    ...(app.port != null ? { PORT: String(app.port) } : {})
  };
  try {
    const { resolveSessionEnv } = await import(
      "../services/parameters/resolveSessionEnv.js"
    );
    const sessionEnv = await resolveSessionEnv(sessionId);
    Object.assign(base, sessionEnv.containerEnv);
    if (app.repo && sessionEnv.byRepo[app.repo]) {
      Object.assign(base, sessionEnv.byRepo[app.repo]);
    }
  } catch (err) {
    console.warn(
      `[runApp] session env resolve failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  try {
    const { sessionAppDbEnvFor } = await import("./sessionAppDb.js");
    Object.assign(base, sessionAppDbEnvFor(sessionId));
  } catch {
    
  }
  if (!app.repo) return base;
  try {
    const { loadWorkspaceSessionContext } = await import(
      "../services/workspace/workspaceSession.js"
    );
    const { resolveEnvTemplates } = await import(
      "../services/workspace/workspaceWiring.js"
    );
    const ctxWs = await loadWorkspaceSessionContext(sessionId);
    if (!ctxWs) return base;
    const member = ctxWs.members.find((m) => m.repoName === app.repo);
    if (!member || !member.env || Object.keys(member.env).length === 0) {
      return base;
    }
    const { config } = await readForgeConfig(sessionId);
    const services = buildServiceUrlMap({
      sessionId,
      apps: config.apps,
      routes: ctxWs.routes
    });
    const resolved = resolveEnvTemplates(member.env, services);
    return { ...base, ...resolved };
  } catch (err) {
    console.warn(
      `[runApp] env template resolve failed for ${app.name}: ${err instanceof Error ? err.message : String(err)}`
    );
    return base;
  }
}

function buildServiceUrlMap(options: {
  sessionId: string;
  apps: ForgeApp[];
  routes: Array<{ pathPrefix: string; target: string }>;
}): Record<string, { internalUrl: string; publicUrl: string }> {
  const scheme = process.env.PREVIEW_URL_SCHEME?.trim() || "http";
  const primaryHost = sessionPreviewHostname(options.sessionId);
  const primaryUrl = previewUrlForHostname(primaryHost, scheme).replace(
    /\/$/,
    ""
  );
  const portByRepo = new Map<string, number>();
  for (const app of options.apps) {
    if (!app.repo || app.port == null) continue;
    if (!portByRepo.has(app.repo)) portByRepo.set(app.repo, app.port);
  }
  const out: Record<string, { internalUrl: string; publicUrl: string }> = {};
  for (const [repo, port] of portByRepo) {
    const route = options.routes.find((r) => r.target === repo);
    const prefix = route?.pathPrefix ?? "/";
    const publicUrl =
      prefix === "/" ? primaryUrl : `${primaryUrl}${prefix.replace(/\/$/, "")}`;
    out[repo] = {
      internalUrl: `http://localhost:${port}`,
      publicUrl
    };
  }
  return out;
}

async function startAppProcess(options: {
  sessionId: string;
  containerName: string;
  app: ForgeApp;
  appDir: string;
}): Promise<{ ok: true } | { ok: false; failure: AppStartFailure }> {
  const { sessionId, containerName, app, appDir } = options;
  const extraEnv = await resolveAppExtraEnv(sessionId, app);
  
  await stopBackgroundJob({
    containerName,
    kind: "app",
    name: app.name
  }).catch(() => undefined);
  if (app.port != null) {
    await freeListeningPort({ containerName, port: app.port });
  }
  await startBackgroundJob({
    containerName,
    kind: "app",
    name: app.name,
    cwd: appDir,
    command: app.command,
    extraEnv: Object.keys(extraEnv).length > 0 ? extraEnv : undefined
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
  const restarted = await startAppProcess({
    sessionId,
    containerName,
    app,
    appDir
  });
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
  void import("./sessionActivity.js")
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
  const { pathExistsInSandbox } = await import("./sandboxExec.js");
  const { jobLogFile } = await import("./backgroundJob.js");
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
  return flags.filter((f): f is { name: string; running: boolean } => f != null);
}


export async function autoStartPreview(sessionId: string): Promise<void> {
  try {
    const { apps } = await listAppStatuses(sessionId);
    if (apps.length === 0) return;

    let ordered = apps;
    try {
      const { loadWorkspaceSessionContext } = await import(
        "../services/workspace/workspaceSession.js"
      );
      const { topoSortRepoNames } = await import(
        "../services/workspace/workspaceWiring.js"
      );
      const ctxWs = await loadWorkspaceSessionContext(sessionId);
      if (ctxWs && ctxWs.members.length > 0) {
        const order = topoSortRepoNames(
          ctxWs.members.map((m) => ({
            repoName: m.repoName,
            dependsOn: m.dependsOn ?? []
          }))
        );
        ordered = order.flatMap((repo) =>
          apps.filter((a) => a.repo === repo)
        );
        
        const seen = new Set(ordered.map((a) => a.name));
        for (const a of apps) {
          if (!seen.has(a.name)) ordered.push(a);
        }
      }
    } catch {
      
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
  const { loadWorkspaceSessionContext } = await import(
    "../services/workspace/workspaceSession.js"
  );
  const { registerPreviewRoute } = await import(
    "../preview/previewPlaneClient.js"
  );
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
