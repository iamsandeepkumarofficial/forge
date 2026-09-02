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

async function detectPm(
  containerName: string,
  dir: string
): Promise<string> {
  const lock = await dockerExec({
    container: containerName,
    argv: [
      "sh",
      "-c",
      `cd "${dir}"; if [ -f pnpm-lock.yaml ]; then echo pnpm; elif [ -f yarn.lock ]; then echo yarn; elif [ -f bun.lockb ]; then echo bun; else echo npm; fi`
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

async function detectAppsInDir(options: {
  containerName: string;
  baseDir: string;
  repo?: string;
  /** When true, cwd is session-relative (repo or repo/apps/x). */
  sessionRelativeCwd?: boolean;
  pm: string;
  nextPort: { value: number };
}): Promise<ForgeApp[]> {
  const { containerName, baseDir, repo, pm, sessionRelativeCwd } = options;
  const devCmd = devCommand(pm);
  const apps: ForgeApp[] = [];

  const rootPkg = await readFileFromSandbox(
    containerName,
    `${baseDir}/package.json`
  );
  if (rootPkg) {
    try {
      const pkg = JSON.parse(rootPkg) as {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      if (pkg.scripts?.dev || pkg.scripts?.start) {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const type = guessType(deps);
        const name = (pkg.name || (repo ? repo : "app")).replace(
          /^@[^/]+\//,
          ""
        );
        const app: ForgeApp = {
          name,
          cwd: sessionRelativeCwd && repo ? repo : ".",
          command: pkg.scripts.dev ? devCmd : `${pm === "yarn" ? "yarn" : pm === "pnpm" ? "pnpm run" : "npm run"} start`,
          type
        };
        if (repo) app.repo = repo;
        if (type !== "worker" && options.nextPort.value < FIRST_APP_PORT + RESERVED_PORTS) {
          app.port = options.nextPort.value++;
        }
        apps.push(app);
      }
    } catch {
      /* ignore */
    }
  }

  const lsr = await dockerExec({
    container: containerName,
    argv: ["sh", "-c", `ls -1 "${baseDir}/apps" 2>/dev/null`]
  });
  const dirs = lsr.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const dir of dirs) {
    const pkgRaw = await readFileFromSandbox(
      containerName,
      `${baseDir}/apps/${dir}/package.json`
    );
    if (pkgRaw === null) continue;
    try {
      const pkg = JSON.parse(pkgRaw) as {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      if (!pkg.scripts?.dev) continue;
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const type = guessType(deps);
      const name = (pkg.name || dir).replace(/^@[^/]+\//, "");
      const app: ForgeApp = {
        name,
        cwd:
          sessionRelativeCwd && repo
            ? `${repo}/apps/${dir}`
            : `apps/${dir}`,
        command: devCmd,
        type
      };
      if (repo) app.repo = repo;
      if (type !== "worker" && options.nextPort.value < FIRST_APP_PORT + RESERVED_PORTS) {
        app.port = options.nextPort.value++;
      }
      apps.push(app);
    } catch {
      continue;
    }
  }
  return apps;
}

export async function detectApps(sessionId: string): Promise<ForgeConfig> {
  const { containerName, workingDir, worktrees } = await resolveSandbox(sessionId);
  const nextPort = { value: FIRST_APP_PORT };
  const apps: ForgeApp[] = [];

  if (worktrees && Object.keys(worktrees).length > 0) {
    for (const [repo, mount] of Object.entries(worktrees).sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      const pm = await detectPm(containerName, mount);
      const memberApps = await detectAppsInDir({
        containerName,
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

  const pm = await detectPm(containerName, workingDir);
  const rootApps = await detectAppsInDir({
    containerName,
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

/** Scaffold launch.json when missing/empty and detectApps finds apps. */
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
    const { seedLaunchFromWorkspace } = await import("./workspaceEnvironment.js");
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
