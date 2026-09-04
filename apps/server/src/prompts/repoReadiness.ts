import fs from "node:fs";
import path from "node:path";

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
  source: "launch" | "legacy" | "none";
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
  source: "launch" | "legacy" | "none";
  apps: LaunchAppPeek[];
} {
  const launchApps = peekApps(path.join(mountPath, ".forge", "launch.json"));
  if (launchApps) {
    return { source: "launch", apps: launchApps };
  }
  const legacyApps = peekApps(path.join(mountPath, "forge.json"));
  if (legacyApps) {
    return { source: "legacy", apps: legacyApps };
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

export function formatRepoSetupBlock(options: {
  readiness: LaunchReadiness;
  
  memberRepos?: string[];
}): string {
  const { readiness, memberRepos } = options;
  const isWorkspace = Boolean(memberRepos && memberRepos.length > 0);
  const lines = [
    "## Repo setup",
    isWorkspace
      ? "This workspace session mounts multiple repositories as siblings under `/workspace`. **One** launch file at the session root: `/workspace/.forge/launch.json`. Do **not** create per-member `bp-frontend/.forge/launch.json`."
      : "This session runs apps from `.forge/launch.json` at the repo root:",
    isWorkspace
      ? '{ apps: [{ name, repo, cwd, command, port?, type: web|api|worker }] }. cwd is session-relative (e.g. `"bp-frontend"` or `"bp-frontend/apps/web"`).'
      : "{ apps: [{ name, cwd, command, port?, type: web|api|worker }] }.",
    formatReadinessEval(readiness, memberRepos),
    "",
    "## Starting apps (mandatory)",
    "- Identify each member's stack from inventory / shadows, then `invoke_skill` (`nodejs-app`, `python-app`, …). Skills own install and launch mapping — use `run_terminal` for installs/toolchains as the skill directs (`ask_user` before installing a missing toolchain).",
    "- Confirm dependencies are installed before preview (e.g. `node_modules` for Node, venv/site-packages for Python). Dev servers stay forbidden on `run_terminal`.",
    "- Fill empty env via `ask_user` (form/mcq widget) then `upsert_workspace_parameter`. For Postgres/Mongo call `ask_user` to confirm, then `provision_app_engine` with `userApproved: true`. Do not ask only in prose. Forge reuses one shared container per image on docker network `forge` and injects `DATABASE_URL` / `MONGODB_URI`. Run migrations via `run_terminal` **before** starting the API. Do **not** install database servers.",
    "- To run a web/api app: `upsert_launch_app` (if missing) then `preview_start` (network plane, ports 3000–3009). Do **not** use `run_terminal` for `npm`/`yarn`/`pnpm` `dev`/`start` or long-running Python servers — it times out.",
    "- Start **api/backends before web/frontends** when `dependsOn` or health says so.",
    "- For Node, prefer the lockfile package manager (`yarn` if `yarn.lock`, `pnpm` if `pnpm-lock.yaml`, else `npm`). For other stacks follow the invoked skill.",
    isWorkspace
      ? `- For workspace upserts, set \`cwd\` under the member (e.g. \`cwd: "bp-frontend"\` or \`cwd: "bp-frontend/apps/web"\`) — Forge writes \`/workspace/.forge/launch.json\`.`
      : "- After upsert_launch_app, call preview_start with that app name.",
    "",
    "## Published app ports (network plane)",
    "- Apps are published on the **network plane** (preview hostnames). Only container ports **3000–3009** are published. Use `port: 3000` for the first web app, then 3001, 3002, …",
    "- Dev servers must honor `PORT` and bind `HOST=0.0.0.0` (Forge sets both when starting apps).",
    "- Do not put 4000, 5173, 8080, or other ports in launch.json — they are not published and preview will be blank.",
    "- Env hint inside the sandbox: `FORGE_PUBLISHED_APP_PORTS=3000-3009`.",
    "- Launch config written in this session stays in the session worktree until the user promotes from the workbench — do not assume other chats see it."
  ];
  return lines.join("\n");
}

function formatReadinessEval(
  readiness: LaunchReadiness,
  memberRepos?: string[]
): string {
  if (readiness.members && readiness.members.length > 0) {
    const perRepo = readiness.members
      .map((m) =>
        m.ready
          ? `- \`${m.repo}\`: listed (${formatAppList(m.apps)})`
          : `- \`${m.repo}\`: no apps in session-root launch.json yet`
      )
      .join("\n");
    if (readiness.ready) {
      return `Eval: agent-ready (session-root \`/workspace/.forge/launch.json\` has apps).\n${perRepo}`;
    }
    return `Eval: not agent-ready — \`/workspace/.forge/launch.json\` is missing or empty.\n${perRepo}\nInspect members ${memberRepos?.map((r) => `\`${r}\``).join(", ") ?? ""}, then upsert_launch_app (cwd under member) and preview_start.`;
  }
  if (readiness.ready) {
    return `Eval: agent-ready. Apps: ${formatAppList(readiness.apps)}.`;
  }
  if (readiness.source === "none") {
    return "Eval: not agent-ready — `.forge/launch.json` is missing. Inspect the repo and upsert_launch_app, then preview_start.";
  }
  return "Eval: not agent-ready — `.forge/launch.json` has no apps. Inspect the repo and upsert_launch_app, then preview_start.";
}
