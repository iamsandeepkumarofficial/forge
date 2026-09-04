import fs from "node:fs";
import path from "node:path";
import {
  readRepoFactsFromHost,
  type PackageManager,
  type RepoFacts
} from "./repoFacts.js";
import { readFileFromSandbox } from "./sandboxExec.js";

export type RepoInventoryMember = {
  repo: string;
  mountPath: string;
  facts: RepoFacts;
};

export type RepoInventory = {
  isWorkspace: boolean;
  members: RepoInventoryMember[];
  dependsOnGraph: Array<{ repo: string; dependsOn: string[] }>;
  suggestedSkills: string[];
};

function formatPm(pm: PackageManager | undefined): string {
  if (!pm) return "unknown (no lockfile)";
  return pm;
}

function formatLaunchApps(facts: RepoFacts, repo: string): string {
  if (facts.launchApps.length === 0) {
    return "`.forge/launch.json`: missing";
  }
  const lines = facts.launchApps.map((a) => {
    const parts = [
      a.type ?? "app",
      `\`${a.name}\``,
      a.cwd ? `cwd \`${repo}/${a.cwd === "." ? "" : a.cwd}\`` : "",
      a.command ? `command \`${a.command}\`` : "",
      a.port != null ? `port ${a.port}` : ""
    ].filter(Boolean);
    return parts.join(" ");
  });
  return "`.forge/launch.json`: " + lines.join("; ");
}

export function buildRepoInventoryFromFacts(options: {
  members: Array<{ repo: string; mountPath: string; facts: RepoFacts }>;
  dependsOnGraph?: Array<{ repo: string; dependsOn: string[] }>;
}): RepoInventory {
  const allSkills = new Set<string>();
  for (const m of options.members) {
    for (const s of m.facts.suggestedSkills) allSkills.add(s);
  }
  return {
    isWorkspace: options.members.length > 1,
    members: options.members,
    dependsOnGraph: options.dependsOnGraph ?? [],
    suggestedSkills: [...allSkills].sort()
  };
}

export function formatRepoInventoryBlock(inventory: RepoInventory): string {
  const lines = [
    "## Workspace repos",
    inventory.isWorkspace
      ? "Per-member inventory for this workspace session:"
      : "Repository inventory for this session:"
  ];
  for (const { repo, mountPath, facts } of inventory.members) {
    lines.push(`- \`${repo}/\` → \`${mountPath}\``);
    if (!facts.analyzable) {
      lines.push(`  - status: not analyzable (needs clone or missing on disk)`);
      continue;
    }
    if (facts.packageJsonPaths.length > 0) {
      lines.push(
        `  - package.json: ${facts.packageJsonPaths.map((p) => `\`${p}\``).join(", ")}`
      );
      lines.push(`  - package manager: ${formatPm(facts.packageManager)}`);
      if (facts.scripts.length > 0) {
        lines.push(`  - scripts: ${facts.scripts.join(", ")}`);
      }
    } else if (facts.ecosystemEvidence.length === 0) {
      lines.push(`  - package.json: none at repo root`);
    }
    if (facts.ecosystemEvidence.length > 0) {
      const ev = facts.ecosystemEvidence
        .map(
          (e) =>
            `${e.ecosystem}(${e.manifests.join(", ")}${e.packageManagerGuess ? `; ~${e.packageManagerGuess}` : ""})`
        )
        .join("; ");
      lines.push(`  - ecosystem evidence: ${ev}`);
    }
    if (facts.detectedStack.length > 0) {
      lines.push(`  - stack: ${facts.detectedStack.join(", ")}`);
    }
    if (!inventory.isWorkspace) {
      lines.push(`  - ${formatLaunchApps(facts, repo)}`);
    }
    if (facts.envKeysReferenced.length > 0) {
      lines.push(
        `  - env keys referenced: ${facts.envKeysReferenced.slice(0, 12).join(", ")}${facts.envKeysReferenced.length > 12 ? ", …" : ""}`
      );
    }
  }
  if (inventory.isWorkspace) {
    lines.push(
      "- Launch config: **only** `/workspace/.forge/launch.json` (session-root). Apps use `repo` + session-relative `cwd` (e.g. `bp-frontend`). Do not create per-member `.forge/launch.json`."
    );
  }
  if (inventory.dependsOnGraph.length > 0) {
    const order = inventory.dependsOnGraph
      .map((g) =>
        g.dependsOn.length > 0
          ? `\`${g.repo}\` depends on ${g.dependsOn.map((d) => `\`${d}\``).join(", ")}`
          : `\`${g.repo}\` (no deps)`
      )
      .join("; ");
    lines.push(`- Startup order (dependsOn): ${order}`);
  }
  if (inventory.suggestedSkills.length > 0) {
    lines.push(
      `- Suggested skills: ${inventory.suggestedSkills.map((s) => `\`${s}\``).join(", ")} (invoke_skill to load)`
    );
  }
  lines.push(
    "- Forge injects `DATABASE_URL` and `MONGODB_URI` (network plane: `postgres-apps` / `mongo-apps` on docker network `forge`). Do not install database servers."
  );
  return lines.join("\n");
}


export function loadRepoInventoryFromHost(options: {
  members: Array<{ repo: string; hostPath: string; analyzable?: boolean }>;
  dependsOnGraph?: Array<{ repo: string; dependsOn: string[] }>;
}): RepoInventory {
  const members = options.members.map(({ repo, hostPath, analyzable }) => {
    const mountPath = options.members.length > 1 ? `/workspace/${repo}` : "/workspace";
    return {
      repo,
      mountPath,
      facts: readRepoFactsFromHost({
        rootPath: hostPath,
        repoName: repo,
        analyzable: analyzable ?? fs.existsSync(hostPath)
      })
    };
  });
  return buildRepoInventoryFromFacts({ members, dependsOnGraph: options.dependsOnGraph });
}

async function readSandboxFile(
  containerName: string,
  absPath: string
): Promise<string | null> {
  return readFileFromSandbox(containerName, absPath);
}


export async function loadRepoInventoryFromSandbox(options: {
  containerName: string;
  worktrees: Record<string, string>;
  dependsOnGraph?: Array<{ repo: string; dependsOn: string[] }>;
}): Promise<RepoInventory> {
  const { containerName, worktrees } = options;
  const names = Object.keys(worktrees).sort();
  const members: RepoInventoryMember[] = [];

  for (const repo of names) {
    const mount = worktrees[repo]!;
    const tmpDir = path.join(
      process.env.TMPDIR || "/tmp",
      `forge-inv-${repo}-${Date.now()}`
    );
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      const pkgRaw = await readSandboxFile(containerName, `${mount}/package.json`);
      if (pkgRaw) {
        fs.writeFileSync(path.join(tmpDir, "package.json"), pkgRaw);
      }
      const launchRaw = await readSandboxFile(
        containerName,
        `${mount}/.forge/launch.json`
      );
      if (launchRaw) {
        fs.mkdirSync(path.join(tmpDir, ".forge"), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, ".forge", "launch.json"), launchRaw);
      }
      for (const lock of [
        "pnpm-lock.yaml",
        "yarn.lock",
        "package-lock.json",
        "bun.lockb"
      ]) {
        const raw = await readSandboxFile(containerName, `${mount}/${lock}`);
        if (raw) fs.writeFileSync(path.join(tmpDir, lock), raw);
      }
      members.push({
        repo,
        mountPath: mount,
        facts: readRepoFactsFromHost({ rootPath: tmpDir, repoName: repo })
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  return buildRepoInventoryFromFacts({
    members,
    dependsOnGraph: options.dependsOnGraph
  });
}
