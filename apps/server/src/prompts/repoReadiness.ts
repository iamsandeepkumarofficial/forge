import fs from "node:fs";
import path from "node:path";

export type LaunchAppPeek = {
  name: string;
  type?: string;
  repo?: string;
};

export type LaunchReadiness = {
  ready: boolean;
  source: "launch" | "legacy" | "none";
  apps: LaunchAppPeek[];
  /** Present for multi-repo workspace sessions. */
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
      const rec = item as { name?: unknown; type?: unknown };
      if (typeof rec.name !== "string" || !rec.name.trim()) {
        return [];
      }
      const app: LaunchAppPeek = { name: rec.name.trim() };
      if (typeof rec.type === "string" && rec.type.trim()) {
        app.type = rec.type.trim();
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

/** Scan each member mount for `.forge/launch.json` (workspace sessions). */
export function loadWorkspaceLaunchReadiness(
  worktrees: Record<string, string>
): LaunchReadiness {
  const members: NonNullable<LaunchReadiness["members"]> = [];
  const apps: LaunchAppPeek[] = [];
  let source: LaunchReadiness["source"] = "none";

  for (const repo of Object.keys(worktrees).sort()) {
    const found = peekLaunchAt(worktrees[repo]!);
    const memberApps = found.apps.map((a) => ({ ...a, repo }));
    members.push({
      repo,
      ready: memberApps.length > 0,
      apps: memberApps
    });
    if (found.source !== "none" && source === "none") {
      source = found.source;
    } else if (found.source === "launch") {
      source = "launch";
    }
    apps.push(...memberApps);
  }

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
      return a.repo ? `${base} in \`${a.repo}\`` : base;
    })
    .join(", ");
}

export function formatRepoSetupBlock(options: {
  readiness: LaunchReadiness;
  /** Member repo names for workspace sessions. */
  memberRepos?: string[];
}): string {
  const { readiness, memberRepos } = options;
  const isWorkspace = Boolean(memberRepos && memberRepos.length > 0);
  const lines = [
    "## Repo setup",
    isWorkspace
      ? "This workspace session mounts multiple repositories. Each has its own `.forge/launch.json` under that repo (example: `bp-frontend/.forge/launch.json`). Never write launch config at the session root `/workspace/.forge/`."
      : "This session runs apps from `.forge/launch.json` at the repo root:",
    "{ apps: [{ name, cwd, command, port?, type: web|api|worker }] }.",
    formatReadinessEval(readiness, memberRepos),
    "",
    "## Starting apps (mandatory)",
    "- To run a web/api app: `upsert_launch_app` (if missing) then `preview_start`. Do **not** use `run_terminal` for `npm`/`yarn`/`pnpm` `dev`/`start` — it times out.",
    "- Do **not** install databases, system packages, or long-running services to “get the app running”. Prefer `preview_start`; ask the user if an external DB/service is required.",
    "- Prefer the lockfile package manager (`yarn` if `yarn.lock`, `pnpm` if `pnpm-lock.yaml`, else `npm`).",
    isWorkspace
      ? `- For workspace upserts, set \`cwd\` under the member repo (e.g. \`cwd: "bp-frontend"\` or \`cwd: "bp-frontend/apps/web"\`) so launch.json is written into that repo.`
      : "- After upsert_launch_app, call preview_start with that app name.",
    "",
    "## Published app ports",
    "- Only container ports **3000–3009** are published for preview. Use `port: 3000` for the first web app, then 3001, 3002, …",
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
          ? `- \`${m.repo}\`: ready (${formatAppList(m.apps)})`
          : `- \`${m.repo}\`: missing \`.forge/launch.json\``
      )
      .join("\n");
    if (readiness.ready) {
      return `Eval: agent-ready (at least one member has apps).\n${perRepo}`;
    }
    return `Eval: not agent-ready — no member has \`.forge/launch.json\` apps yet.\n${perRepo}\nInspect each repo under ${memberRepos?.map((r) => `\`${r}\``).join(", ") ?? "member mounts"}, then upsert_launch_app per repo and preview_start.`;
  }
  if (readiness.ready) {
    return `Eval: agent-ready. Apps: ${formatAppList(readiness.apps)}.`;
  }
  if (readiness.source === "none") {
    return "Eval: not agent-ready — `.forge/launch.json` is missing. Inspect the repo and upsert_launch_app, then preview_start.";
  }
  return "Eval: not agent-ready — `.forge/launch.json` has no apps. Inspect the repo and upsert_launch_app, then preview_start.";
}
