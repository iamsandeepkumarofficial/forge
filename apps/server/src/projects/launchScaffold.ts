import {
  resolveSandbox,
  dockerExec,
  readFileFromSandbox
} from "./sandboxExec.js";
import { FIRST_APP_PORT, RESERVED_PORTS } from "./sessionSandbox.js";
import {
  readForgeConfig,
  writeForgeConfig,
  type AppType,
  type ForgeApp,
  type ForgeConfig
} from "./appRunner.js";
import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import {
  formatLaunchAppNames,
  logLaunchConfigExisting,
  logLaunchConfigNone,
  logLaunchConfigScaffolded,
  type LaunchConfigSource
} from "./launchConfigLog.js";

function guessType(deps: Record<string, string>): AppType {
  const has = (n: string) => Object.prototype.hasOwnProperty.call(deps, n);
  if (
    has("next") ||
    has("vite") ||
    has("react-scripts") ||
    has("@remix-run/react") ||
    has("nuxt")
  ) {
    return "web";
  }
  if (
    has("@nestjs/core") ||
    has("express") ||
    has("fastify") ||
    has("koa") ||
    has("@hapi/hapi")
  ) {
    return "api";
  }
  return "worker";
}

async function detectPm(options: {
  containerName: string;
  dir: string;
  sessionId: string;
}): Promise<string> {
  const lock = await dockerExec({
    container: options.containerName,
    sessionId: options.sessionId,
    argv: [
      "sh",
      "-c",
      `cd "${options.dir}"; if [ -f pnpm-lock.yaml ]; then echo pnpm; elif [ -f yarn.lock ]; then echo yarn; elif [ -f bun.lockb ]; then echo bun; else echo npm; fi`
    ]
  });
  return lock.stdout.trim() || "npm";
}

function devCommand(pm: string): string {
  if (pm === "pnpm") return "pnpm run dev";
  if (pm === "yarn") return "yarn dev";
  if (pm === "bun") return "bun run dev";
  return "npm run dev";
}

type PkgJson = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

function appFromPackageJson(options: {
  pkg: PkgJson;
  dirName?: string;
  repo?: string;
  sessionRelativeCwd?: boolean;
  pm: string;
  devCmd: string;
  nextPort: { value: number };
  requireDevOnly?: boolean;
}): ForgeApp | null {
  const { pkg, repo, sessionRelativeCwd, pm, devCmd, nextPort } = options;
  if (options.requireDevOnly) {
    if (!pkg.scripts?.dev) return null;
  } else if (!pkg.scripts?.dev && !pkg.scripts?.start) {
    return null;
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const type = guessType(deps);
  const fallback = options.dirName || (repo ? repo : "app");
  const name = (pkg.name || fallback).replace(/^@[^/]+\//, "");
  const cwd = options.dirName
    ? sessionRelativeCwd && repo
      ? `${repo}/apps/${options.dirName}`
      : `apps/${options.dirName}`
    : sessionRelativeCwd && repo
      ? repo
      : ".";
  const command = options.dirName
    ? devCmd
    : pkg.scripts?.dev
      ? devCmd
      : `${pm === "yarn" ? "yarn" : pm === "pnpm" ? "pnpm run" : "npm run"} start`;
  const app: ForgeApp = { name, cwd, command, type };
  if (repo) app.repo = repo;
  if (type !== "worker" && nextPort.value < FIRST_APP_PORT + RESERVED_PORTS) {
    app.port = nextPort.value++;
  }
  return app;
}

async function detectAppsInDir(options: {
  containerName: string;
  sessionId: string;
  baseDir: string;
  repo?: string;
  sessionRelativeCwd?: boolean;
  pm: string;
  nextPort: { value: number };
}): Promise<ForgeApp[]> {
  const { containerName, sessionId, baseDir, repo, pm, sessionRelativeCwd } =
    options;
  const devCmd = devCommand(pm);
  const apps: ForgeApp[] = [];
  const rootPkg = await readFileFromSandbox(
    containerName,
    `${baseDir}/package.json`,
    sessionId
  );
  if (rootPkg) {
    try {
      const app = appFromPackageJson({
        pkg: JSON.parse(rootPkg) as PkgJson,
        repo,
        sessionRelativeCwd,
        pm,
        devCmd,
        nextPort: options.nextPort
      });
      if (app) apps.push(app);
    } catch {
      void 0;
    }
  }
  const lsr = await dockerExec({
    container: containerName,
    sessionId,
    argv: ["sh", "-c", `ls -1 "${baseDir}/apps" 2>/dev/null`]
  });
  const dirs = lsr.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const dir of dirs) {
    const pkgRaw = await readFileFromSandbox(
      containerName,
      `${baseDir}/apps/${dir}/package.json`,
      sessionId
    );
    if (pkgRaw === null) continue;
    try {
      const app = appFromPackageJson({
        pkg: JSON.parse(pkgRaw) as PkgJson,
        dirName: dir,
        repo,
        sessionRelativeCwd,
        pm,
        devCmd,
        nextPort: options.nextPort,
        requireDevOnly: true
      });
      if (app) apps.push(app);
    } catch {
      continue;
    }
  }
  return apps;
}

export async function detectApps(sessionId: string): Promise<ForgeConfig> {
  const { containerName, workingDir, worktrees } =
    await resolveSandbox(sessionId);
  const nextPort = { value: FIRST_APP_PORT };
  const apps: ForgeApp[] = [];

  if (worktrees && Object.keys(worktrees).length > 0) {
    for (const [repo, mount] of Object.entries(worktrees).sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      const pm = await detectPm({
        containerName,
        dir: mount,
        sessionId
      });
      const memberApps = await detectAppsInDir({
        containerName,
        sessionId,
        baseDir: mount,
        repo,
        sessionRelativeCwd: true,
        pm,
        nextPort
      });
      apps.push(...memberApps);
    }
    return { apps };
  }

  const pm = await detectPm({
    containerName,
    dir: workingDir,
    sessionId
  });
  const rootApps = await detectAppsInDir({
    containerName,
    sessionId,
    baseDir: workingDir,
    pm,
    nextPort
  });
  return { apps: rootApps };
}

export async function scaffoldForgeConfig(
  sessionId: string
): Promise<ForgeConfig> {
  const config = await detectApps(sessionId);
  await writeForgeConfig(sessionId, config);
  return config;
}

async function chatWorkspaceId(sessionId: string): Promise<string | null> {
  const chat = await new ChatFeatureRepository().getBySessionId(sessionId);
  return chat?.workspaceId ?? null;
}

export async function ensureLaunchConfig(sessionId: string): Promise<{
  ready: boolean;
  scaffolded: boolean;
  seeded?: boolean;
  source: LaunchConfigSource;
}> {
  const workspaceId = await chatWorkspaceId(sessionId);
  const { exists, config } = await readForgeConfig(sessionId);
  if (exists && config.apps.length > 0) {
    logLaunchConfigExisting({
      sessionId,
      workspaceId,
      appCount: config.apps.length,
      appNames: formatLaunchAppNames(config.apps)
    });
    return { ready: true, scaffolded: false, source: "existing" };
  }

  try {
    const { seedLaunchFromWorkspace } =
      await import("./workspaceEnvironment.js");
    const seeded = await seedLaunchFromWorkspace(sessionId);
    if (seeded) {
      return {
        ready: true,
        scaffolded: false,
        seeded: true,
        source: "seeded"
      };
    }
  } catch (err) {
    console.warn(
      `[launchConfig] seed error session=${sessionId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const detected = await detectApps(sessionId);
  if (detected.apps.length === 0) {
    logLaunchConfigNone({ sessionId, workspaceId });
    return { ready: false, scaffolded: false, source: "none" };
  }
  await writeForgeConfig(sessionId, detected);
  logLaunchConfigScaffolded({
    sessionId,
    workspaceId,
    appCount: detected.apps.length,
    appNames: formatLaunchAppNames(detected.apps)
  });
  return { ready: true, scaffolded: true, source: "scaffolded" };
}
