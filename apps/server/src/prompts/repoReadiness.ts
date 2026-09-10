import fs from "node:fs";
import path from "node:path";
import { appDbInjectionHint } from "../projects/appDb/engines.js";

export type LaunchAppPeek = {
  name: string;
  type?: string;
  repo?: string;
  cwd?: string;
  command?: string;
  port?: number;
};

export type LaunchReadiness = {
  ready: boolean;
  source: "launch" | "none";
  apps: LaunchAppPeek[];

  members?: Array<{
    repo: string;
    ready: boolean;
    apps: LaunchAppPeek[];
  }>;
};

function peekApps(filePath: string): LaunchAppPeek[] | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { apps?: unknown };
    if (!Array.isArray(parsed.apps)) {
      return [];
    }
    return parsed.apps.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const rec = item as Record<string, unknown>;
      if (typeof rec.name !== "string" || !rec.name.trim()) {
        return [];
      }
      const app: LaunchAppPeek = { name: rec.name.trim() };
      if (typeof rec.type === "string" && rec.type.trim()) {
        app.type = rec.type.trim();
      }
      if (typeof rec.repo === "string" && rec.repo.trim()) {
        app.repo = rec.repo.trim();
      }
      if (typeof rec.cwd === "string" && rec.cwd.trim()) {
        app.cwd = rec.cwd.trim();
      }
      if (typeof rec.command === "string" && rec.command.trim()) {
        app.command = rec.command.trim();
      }
      if (typeof rec.port === "number") {
        app.port = rec.port;
      }
      return [app];
    });
  } catch {
    return [];
  }
}

function peekLaunchAt(mountPath: string): {
  source: "launch" | "none";
  apps: LaunchAppPeek[];
} {
  const launchApps = peekApps(path.join(mountPath, ".forge", "launch.json"));
  if (launchApps) {
    return { source: "launch", apps: launchApps };
  }
  return { source: "none", apps: [] };
}

export function loadLaunchReadiness(workingDir: string): LaunchReadiness {
  const found = peekLaunchAt(workingDir);
  return {
    ready: found.apps.length > 0,
    source: found.source,
    apps: found.apps
  };
}

export function loadWorkspaceLaunchReadiness(options: {
  sessionRoot: string;
  memberRepos: string[];
}): LaunchReadiness {
  const { sessionRoot, memberRepos } = options;
  const found = peekLaunchAt(sessionRoot);
  return readinessFromLaunchApps({
    apps: found.apps,
    source: found.source,
    memberRepos
  });
}

export function readinessFromForgeApps(options: {
  apps: Array<{
    name: string;
    type?: string;
    repo?: string;
    cwd?: string;
    command?: string;
    port?: number;
  }>;
  source?: LaunchReadiness["source"];
  memberRepos: string[];
}): LaunchReadiness {
  const apps: LaunchAppPeek[] = options.apps.map((a) => ({
    name: a.name,
    type: a.type,
    repo: a.repo,
    cwd: a.cwd,
    command: a.command,
    port: a.port
  }));
  return readinessFromLaunchApps({
    apps,
    source: options.source ?? (apps.length > 0 ? "launch" : "none"),
    memberRepos: options.memberRepos
  });
}

function readinessFromLaunchApps(options: {
  apps: LaunchAppPeek[];
  source: LaunchReadiness["source"];
  memberRepos: string[];
}): LaunchReadiness {
  const { apps, source, memberRepos } = options;
  const byRepo = new Map<string, LaunchAppPeek[]>();
  for (const name of memberRepos) {
    byRepo.set(name, []);
  }
  for (const app of apps) {
    const repo =
      app.repo ||
      (app.cwd && memberRepos.includes(app.cwd.split("/")[0]!)
        ? app.cwd.split("/")[0]!
        : undefined);
    if (repo && byRepo.has(repo)) {
      byRepo.get(repo)!.push({ ...app, repo });
    }
  }
  const members = memberRepos.map((repo) => {
    const memberApps = byRepo.get(repo) ?? [];
    return {
      repo,
      ready: memberApps.length > 0,
      apps: memberApps
    };
  });
  return {
    ready: apps.length > 0,
    source,
    apps,
    members
  };
}

function formatAppList(apps: LaunchAppPeek[]): string {
  return apps
    .map((a) => {
      const base = a.type ? `\`${a.name}\` (${a.type})` : `\`${a.name}\``;
      const cwd = a.cwd ? ` cwd \`${a.cwd}\`` : "";
      return a.repo ? `${base} in \`${a.repo}\`${cwd}` : `${base}${cwd}`;
    })
    .join(", ");
}

export function formatReadinessSummary(readiness: LaunchReadiness): string {
  if (readiness.members && readiness.members.length > 0) {
    const perRepo = readiness.members
      .map((m) =>
        m.ready
          ? `- \`${m.repo}\`: listed (${formatAppList(m.apps)})`
          : `- \`${m.repo}\`: no apps in session-root launch.json yet`
      )
      .join("\n");
    if (readiness.ready) {
      return `Launch ready (session-root \`/workspace/.forge/launch.json\` has apps).\n${perRepo}`;
    }
    return `Launch not ready — \`/workspace/.forge/launch.json\` is missing or empty.\n${perRepo}`;
  }
  if (readiness.ready) {
    return `Launch ready. Apps: ${formatAppList(readiness.apps)}.`;
  }
  if (readiness.source === "none") {
    return "Launch not ready — `.forge/launch.json` is missing.";
  }
  return "Launch not ready — `.forge/launch.json` has no apps.";
}

export function formatPlatformOpsBlock(options: {
  executionTarget: "local" | "cloud";
  isWorkspace: boolean;
  memberRepos?: string[];
}): string {
  const { executionTarget, isWorkspace, memberRepos } = options;
  const isHost = executionTarget === "local";
  const first = memberRepos?.[0] ?? "repo";
  const lines = [
    "## Starting apps",
    "- Identify stack from `## Workspace repos` / inventory, then `invoke_skill` for that stack. Skills own install, package manager, and how the app binds PORT/HOST.",
    "- Confirm dependencies are installed before preview (follow the skill). Long-running app servers must use `preview_start`, not `run_terminal`.",
    `- Fill empty env via \`ask_user\` then \`upsert_workspace_parameter\`. For Postgres/Mongo: \`ask_user\` → \`setup_project_infra\` with \`userApproved: true\`; on missing host binaries use \`install_project_infra\` then retry. ${appDbInjectionHint()}`,
    "- Register apps with `upsert_launch_app` (if missing) then `preview_start`.",
    "- Start backends before frontends when `dependsOn` or health says so.",
    isWorkspace
      ? `- Workspace upserts: set \`cwd\` under the member (e.g. \`${first}\`). Forge writes \`/workspace/.forge/launch.json\` only.`
      : "- After upsert_launch_app, call preview_start with that app name.",
    "",
    "## Published app ports",
    isHost
      ? "- Host sessions bind apps on registry ports **40000–49999** (Forge allocates and injects `PORT`). Do not assume Docker’s 3000–3009."
      : "- Preview plane publishes sandbox ports **3000–3009**. Use `port: 3000` for the first web app, then 3001, …",
    "- Apps must honor `PORT` and bind `HOST` as the invoked skill describes (Forge sets both when starting apps).",
    isHost
      ? "- Prefer omitting a fixed port in launch.json or pass a registry port; Forge remaps Docker-style 3000–3009 to a host registry port."
      : "- Do not put 4000, 5173, 8080, or other ports in launch.json — they are not published and preview will be blank.",
    isHost
      ? "- Env hint: `FORGE_PUBLISHED_APP_PORTS=40000-49999`."
      : "- Env hint: `FORGE_PUBLISHED_APP_PORTS=3000-3009`.",
    "- Call `get_workspace_health` for live launch readiness and running-app status."
  ];
  return lines.join("\n");
}
