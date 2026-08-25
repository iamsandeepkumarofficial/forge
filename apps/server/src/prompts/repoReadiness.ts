import fs from "node:fs";
import path from "node:path";

export type LaunchAppPeek = {
  name: string;
  type?: string;
};

export type LaunchReadiness = {
  ready: boolean;
  source: "launch" | "legacy" | "none";
  apps: LaunchAppPeek[];
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

export function loadLaunchReadiness(workingDir: string): LaunchReadiness {
  const launchApps = peekApps(path.join(workingDir, ".forge", "launch.json"));
  if (launchApps) {
    return {
      ready: launchApps.length > 0,
      source: "launch",
      apps: launchApps
    };
  }
  const legacyApps = peekApps(path.join(workingDir, "forge.json"));
  if (legacyApps) {
    return {
      ready: legacyApps.length > 0,
      source: "legacy",
      apps: legacyApps
    };
  }
  return { ready: false, source: "none", apps: [] };
}

function formatAppList(apps: LaunchAppPeek[]): string {
  return apps
    .map((a) => (a.type ? `\`${a.name}\` (${a.type})` : `\`${a.name}\``))
    .join(", ");
}

export function formatRepoSetupBlock(options: {
  readiness: LaunchReadiness;
}): string {
  const { readiness } = options;
  const lines = [
    "## Repo setup",
    "This session runs apps from `.forge/launch.json`:",
    "{ apps: [{ name, cwd, command, port?, type: web|api|worker }] }.",
    formatReadinessEval(readiness),
    "Use preview_start / preview_stop to start and stop apps in the repository."
  ];
  return lines.join("\n");
}

function formatReadinessEval(readiness: LaunchReadiness): string {
  if (readiness.ready) {
    return `Eval: agent-ready. Apps: ${formatAppList(readiness.apps)}.`;
  }
  if (readiness.source === "none") {
    return "Eval: not agent-ready — `.forge/launch.json` is missing. Inspect the repo and upsert_launch_app.";
  }
  return "Eval: not agent-ready — `.forge/launch.json` has no apps. Inspect the repo and upsert_launch_app.";
}
