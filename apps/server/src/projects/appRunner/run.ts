import {
  previewUrlForHostname,
  sessionPreviewHostname
} from "../sandboxRuntime/hostnames.js";
import {
  startBackgroundJob,
  stopBackgroundJob,
  freeListeningPort,
  waitUntilJobRunning,
  waitUntilTcpListening
} from "../backgroundJob.js";
import { resolveLaunchAppDir } from "../launchCwd.js";
import type { ForgeApp, AppStatus, AppStartFailure } from "./types.js";
import {
  ctx,
  findApp,
  persistAppCwd,
  persistAppPort,
  readForgeConfig
} from "./config.js";

async function loadStatusForApp(
  options: Parameters<typeof import("./status.js").statusForApp>[0]
): Promise<AppStatus> {
  const { statusForApp } = await import("./status.js");
  return statusForApp(options);
}

async function resolveAppListenPort(options: {
  sessionId: string;
  app: ForgeApp;
}): Promise<ForgeApp> {
  const { sessionId } = options;
  const app = options.app;
  if (app.port == null) return app;
  const { getSandboxRuntime } = await import("../sandboxRuntime/resolve.js");
  const runtime = await getSandboxRuntime(sessionId);
  const { config } = await readForgeConfig(sessionId);
  const usedListenPorts = config.apps
    .filter((a) => a.name !== app.name && a.port != null)
    .map((a) => a.port as number);
  const listenPort = await runtime.resolveListenPort({
    sessionId,
    appName: app.name,
    preferred: app.port,
    usedListenPorts
  });
  if (listenPort === app.port) return app;
  console.warn(
    `[runApp] session ${sessionId} app ${app.name}: remapped listen port ${app.port} → ${listenPort} (${runtime.kind})`
  );
  await persistAppPort({ sessionId, name: app.name, port: listenPort });
  return { ...app, port: listenPort };
}

async function resolveAppForLaunch(options: {
  sessionId: string;
  app: ForgeApp;
  containerName: string;
  workingDir: string;
  repoDir: string;
}): Promise<{ nextApp: ForgeApp; appDir: string; error?: string }> {
  const resolved = await resolveLaunchAppDir({
    containerName: options.containerName,
    sessionId: options.sessionId,
    workingDir: options.workingDir,
    repoDir: options.repoDir,
    cwd: options.app.cwd
  });
  const nextApp: ForgeApp = { ...options.app, cwd: resolved.relCwd };
  if (resolved.relCwd !== options.app.cwd) {
    await persistAppCwd({
      sessionId: options.sessionId,
      name: options.app.name,
      cwd: resolved.relCwd
    });
  }
  return {
    nextApp,
    appDir: resolved.appDir,
    ...(resolved.error ? { error: resolved.error } : {})
  };
}

export async function runApp(
  sessionId: string,
  name: string
): Promise<AppStatus> {
  let app = await findApp(sessionId, name);
  const { containerName, workingDir, repoDir } = await ctx(sessionId);
  app = await resolveAppListenPort({ sessionId, app });
  const resolved = await resolveAppForLaunch({
    sessionId,
    app,
    containerName,
    workingDir,
    repoDir
  });
  const nextApp = resolved.nextApp;
  if (resolved.error) {
    return loadStatusForApp({
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
    return loadStatusForApp({
      sessionId,
      app: nextApp,
      containerName,
      startFailure: started.failure
    });
  }
  if (nextApp.port != null) {
    const portReady = await ensureAppPublishedPortReady({
      sessionId,
      containerName,
      app: nextApp,
      appDir: resolved.appDir
    });
    if (!portReady) {
      return loadStatusForApp({
        sessionId,
        app: nextApp,
        containerName,
        startFailure: "port"
      });
    }
    await publishAppPreview({
      sessionId,
      containerName,
      port: nextApp.port
    });
  }
  const status = await loadStatusForApp({
    sessionId,
    app: nextApp,
    containerName
  });
  if (status.running) {
    void persistSuccessfulEnvironment(sessionId);
  }
  return status;
}

async function ensureAppPublishedPortReady(options: {
  sessionId: string;
  containerName: string;
  app: ForgeApp;
  appDir: string;
}): Promise<boolean> {
  const { sessionId, containerName, app, appDir } = options;
  if (app.port == null) return true;
  const { getSandboxRuntime, resolveSandboxRuntimeKindForSession } =
    await import("../sandboxRuntime/resolve.js");
  const runtime = await getSandboxRuntime(sessionId);
  const publishedPort = await runtime.resolvePublishedPort(sessionId, app.port);
  if (publishedPort == null) return true;
  const hostReady = await runtime.ensurePublishedPortReady({
    handle: {
      sessionId,
      runtime: await resolveSandboxRuntimeKindForSession(sessionId),
      ref: containerName
    },
    listenPort: app.port,
    publishedPort,
    onRepairRestart: async () => {
      const restarted = await startAppProcess({
        sessionId,
        containerName,
        app,
        appDir
      });
      return restarted.ok;
    }
  });
  if (!hostReady) {
    await stopBackgroundJob({
      containerName,
      kind: "app",
      name: app.name,
      sessionId
    }).catch(() => undefined);
    return false;
  }
  return true;
}

async function persistSuccessfulEnvironment(sessionId: string): Promise<void> {
  try {
    const { promoteLaunchToWorkspace, captureWorkspaceDepsForSession } =
      await import("../workspaceEnvironment.js");
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
    const { resolveSessionEnv } =
      await import("../../services/parameters/resolveSessionEnv.js");
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
    const { sessionAppDbEnvFor } = await import("../sessionAppDb.js");
    Object.assign(base, await sessionAppDbEnvFor(sessionId));
  } catch {
    void 0;
  }
  if (!app.repo) return base;
  try {
    const { loadWorkspaceSessionContext } =
      await import("../../services/workspace/workspaceSession.js");
    const { resolveEnvTemplates } =
      await import("../../services/workspace/workspaceWiring.js");
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
    name: app.name,
    sessionId
  }).catch(() => undefined);
  if (app.port != null) {
    await freeListeningPort({ containerName, port: app.port, sessionId });
  }
  await startBackgroundJob({
    containerName,
    kind: "app",
    name: app.name,
    cwd: appDir,
    command: app.command,
    extraEnv: Object.keys(extraEnv).length > 0 ? extraEnv : undefined,
    sessionId
  });
  const running = await waitUntilJobRunning({
    containerName,
    kind: "app",
    name: app.name,
    sessionId
  });
  if (!running) return { ok: false, failure: "process" };
  if (app.port == null) return { ok: true };
  const listening = await waitUntilTcpListening({
    containerName,
    port: app.port,
    sessionId
  });
  if (!listening) {
    await stopBackgroundJob({
      containerName,
      kind: "app",
      name: app.name,
      sessionId
    }).catch(() => undefined);
    return { ok: false, failure: "port" };
  }
  return { ok: true };
}

export async function publishAppPreview(input: {
  sessionId: string;
  containerName: string;
  port: number;
}): Promise<void> {
  const { getSandboxRuntime, resolveSandboxRuntimeKindForSession } =
    await import("../sandboxRuntime/resolve.js");
  await (
    await getSandboxRuntime(input.sessionId)
  ).publishPreviewPort(
    {
      sessionId: input.sessionId,
      runtime: await resolveSandboxRuntimeKindForSession(input.sessionId),
      ref: input.containerName
    },
    input.port
  );
}
