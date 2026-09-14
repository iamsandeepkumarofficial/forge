import {
  resolveSandbox,
  readFileFromSandbox,
  writeFileToSandbox
} from "../sandboxExec.js";
import { isReservedAppPort } from "../sessionSandbox.js";
import { normalizeLaunchCwd, safeRelDir } from "../launchCwd.js";
import type { ForgeApp, ForgeConfig, LaunchConfigSource } from "./types.js";
import { matchLaunchApp } from "./matchLaunchApp.js";

export type {
  AppType,
  ForgeApp,
  ForgeConfig,
  AppStartFailure,
  AppStatus,
  LaunchConfigSource
} from "./types.js";

const LAUNCH_FILE = ".forge/launch.json";
export async function ctx(sessionId: string) {
  const { containerName, workingDir, repoDir, worktrees } =
    await resolveSandbox(sessionId);
  return { containerName, workingDir, repoDir, worktrees };
}
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
  const localCwd =
    typeof app.cwd === "string" && app.cwd.trim() ? app.cwd : ".";
  const cwd =
    localCwd === "." || localCwd === ""
      ? repo
      : localCwd === repo || localCwd.startsWith(`${repo}/`)
        ? localCwd.replace(/^\.\//, "")
        : `${repo}/${localCwd.replace(/^\.\//, "")}`;
  const name = app.name.startsWith(`${repo}/`)
    ? app.name
    : `${repo}/${app.name}`;
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

function assertCwdUnderRepo(options: {
  cwd: string;
  repo: string;
  memberRepos: string[];
}): string {
  const { cwd, repo, memberRepos } = options;
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

async function readLaunchAt(options: {
  containerName: string;
  mountPath: string;
  sessionId: string;
}): Promise<{ source: LaunchConfigSource; config: ForgeConfig } | null> {
  const { containerName, mountPath, sessionId } = options;
  const launchRaw = await readFileFromSandbox({
    container: containerName,
    absPath: `${mountPath}/${LAUNCH_FILE}`,
    sessionId
  });
  const launchConfig = parseConfigJson(launchRaw);
  if (launchConfig) {
    return { source: "launch", config: launchConfig };
  }
  return null;
}

export async function readForgeConfig(sessionId: string): Promise<{
  exists: boolean;
  source: LaunchConfigSource;
  config: ForgeConfig;
}> {
  const { containerName, workingDir, worktrees } = await ctx(sessionId);
  const trees =
    worktrees && Object.keys(worktrees).length > 0 ? worktrees : null;
  const memberRepos = trees ? Object.keys(trees).sort() : [];

  if (trees) {
    const rootFound = await readLaunchAt({
      containerName,
      mountPath: workingDir,
      sessionId
    });
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

  const found = await readLaunchAt({
    containerName,
    mountPath: workingDir,
    sessionId
  });
  if (found) {
    return { exists: true, source: found.source, config: found.config };
  }
  return { exists: false, source: "none", config: { apps: [] } };
}

function toWorkspaceRootApp(options: {
  app: ForgeApp;
  repo: string;
  memberRepos: string[];
}): ForgeApp {
  const { app, repo, memberRepos } = options;
  const local = unqualifyApp(app, repo);
  const cwdInput = app.cwd?.startsWith(repo)
    ? app.cwd
    : local.cwd === "."
      ? repo
      : `${repo}/${local.cwd}`;
  const cwd = assertCwdUnderRepo({ cwd: cwdInput, repo, memberRepos });
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
      rootApps.push(
        toWorkspaceRootApp({
          app: { ...app, repo },
          repo,
          memberRepos
        })
      );
    }
    await writeFileToSandbox({
      container: containerName,
      sessionId,
      absPath: `${workingDir}/${LAUNCH_FILE}`,
      content: JSON.stringify({ apps: rootApps }, null, 2) + "\n"
    });
    return;
  }

  await writeFileToSandbox({
    container: containerName,
    sessionId,
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
    const cwd = assertCwdUnderRepo({
      cwd: nextApp.cwd || repo,
      repo,
      memberRepos
    });
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
    port: await resolveLaunchPort({
      sessionId,
      port: portInput,
      usedPorts
    })
  };

  const nextApps = [...others, nextApp];
  const next = { apps: nextApps };
  await writeForgeConfig(sessionId, next);
  return next;
}

export async function resolveLaunchPort(options: {
  sessionId: string;
  port: number | undefined;
  usedPorts: number[];
}): Promise<number | undefined> {
  const { sessionId, port, usedPorts } = options;
  if (port == null) return undefined;
  const { getSandboxRuntime } = await import("../sandboxRuntime/resolve.js");
  const runtime = await getSandboxRuntime(sessionId);
  const range = runtime.publishedAppPortsEnv().replace("-", "–");
  if (runtime.isAllowedListenPort(port)) {
    if (usedPorts.includes(port)) {
      throw new Error(
        `Port ${port} is already used by another app. Choose a free port in ${range}.`
      );
    }
    return port;
  }
  if (runtime.kind === "host" && isReservedAppPort(port)) {
    return runtime.resolveListenPort({
      sessionId,
      appName: "upsert",
      preferred: port,
      usedListenPorts: usedPorts
    });
  }
  throw new Error(
    `Port ${port} is outside published range ${range}. Use a free port in that range.`
  );
}

export async function persistAppPort(options: {
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

export async function persistAppCwd(options: {
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
export async function findApp(
  sessionId: string,
  name: string
): Promise<ForgeApp> {
  const { config } = await readForgeConfig(sessionId);
  const app = matchLaunchApp(config.apps, name);
  if (!app) {
    const known = config.apps.map((a) => a.name).join(", ") || "(none)";
    throw new Error(
      `App not found in .forge/launch.json: ${name}. Known: ${known}. Use upsert_launch_app, then retry.`
    );
  }
  return app;
}

export { matchLaunchApp } from "./matchLaunchApp.js";
