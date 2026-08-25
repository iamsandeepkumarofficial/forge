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

export async function detectApps(sessionId: string): Promise<ForgeConfig> {
  const { containerName, workingDir } = await resolveSandbox(sessionId);
  const lock = await dockerExec({
    container: containerName,
    argv: [
      "sh",
      "-c",
      `cd "${workingDir}"; if [ -f pnpm-lock.yaml ]; then echo pnpm; elif [ -f yarn.lock ]; then echo yarn; else echo npm; fi`
    ]
  });
  const pm = lock.stdout.trim() || "npm";
  const devCmd =
    pm === "pnpm" ? "pnpm run dev" : pm === "yarn" ? "yarn dev" : "npm run dev";
  const lsr = await dockerExec({
    container: containerName,
    argv: ["sh", "-c", `ls -1 "${workingDir}/apps" 2>/dev/null`]
  });
  const dirs = lsr.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const apps: ForgeApp[] = [];
  let nextPort = FIRST_APP_PORT;
  for (const dir of dirs) {
    const pkgRaw = await readFileFromSandbox(
      containerName,
      `${workingDir}/apps/${dir}/package.json`
    );
    if (pkgRaw === null) continue;
    let deps: Record<string, string>;
    let name: string;
    try {
      const pkg = JSON.parse(pkgRaw) as {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      if (!pkg.scripts?.dev) continue;
      deps = { ...pkg.dependencies, ...pkg.devDependencies };
      name = (pkg.name || dir).replace(/^@[^/]+\//, "");
    } catch {
      continue;
    }
    const type = guessType(deps);
    const app: ForgeApp = { name, cwd: `apps/${dir}`, command: devCmd, type };
    if (type !== "worker" && nextPort < FIRST_APP_PORT + RESERVED_PORTS) {
      app.port = nextPort++;
    }
    apps.push(app);
  }
  return { apps };
}

export async function scaffoldForgeConfig(
  sessionId: string
): Promise<ForgeConfig> {
  const config = await detectApps(sessionId);
  await writeForgeConfig(sessionId, config);
  return config;
}

/** Scaffold launch.json when missing/empty and detectApps finds apps. */
export async function ensureLaunchConfig(sessionId: string): Promise<{
  ready: boolean;
  scaffolded: boolean;
}> {
  const { exists, config } = await readForgeConfig(sessionId);
  if (exists && config.apps.length > 0) {
    return { ready: true, scaffolded: false };
  }
  const detected = await detectApps(sessionId);
  if (detected.apps.length === 0) {
    return { ready: false, scaffolded: false };
  }
  await writeForgeConfig(sessionId, detected);
  return { ready: true, scaffolded: true };
}
