import fs from "node:fs";
import path from "node:path";

export type PackageManager = "pnpm" | "yarn" | "npm" | "bun";

export type EcosystemId = "node" | "python" | "go" | "unknown";

export type EcosystemEvidence = {
  ecosystem: EcosystemId;
  manifests: string[];
  lockfiles: string[];

  packageManagerGuess?: string;
};

export type LaunchAppFact = {
  name: string;
  type?: string;
  cwd?: string;
  command?: string;
  port?: number;
};

export type RepoFacts = {
  repoName?: string;
  rootPath: string;
  analyzable: boolean;
  hasPackageJson: boolean;
  packageJsonPaths: string[];
  packageManager?: PackageManager;
  scripts: string[];
  launchApps: LaunchAppFact[];
  launchReady: boolean;
  detectedStack: string[];
  suggestedSkills: string[];

  envKeysFromSource: string[];

  envKeysReferenced: string[];
  envExampleValues: Record<string, string>;
  ecosystemEvidence: EcosystemEvidence[];
};

const LAUNCH_PATHS = [".forge/launch.json", "forge.json"];

function readText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export function detectPackageManager(
  rootPath: string
): PackageManager | undefined {
  const pkgRaw = readText(path.join(rootPath, "package.json"));
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as { packageManager?: string };
      const pm = pkg.packageManager?.split("@")[0]?.trim();
      if (pm === "pnpm" || pm === "yarn" || pm === "npm" || pm === "bun") {
        return pm;
      }
    } catch {
      void 0;
    }
  }
  if (fs.existsSync(path.join(rootPath, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(rootPath, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(rootPath, "bun.lockb"))) return "bun";
  if (fs.existsSync(path.join(rootPath, "package-lock.json"))) return "npm";
  if (pkgRaw) return "npm";
  return undefined;
}

function peekLaunchApps(rootPath: string): LaunchAppFact[] {
  for (const rel of LAUNCH_PATHS) {
    const raw = readText(path.join(rootPath, rel));
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { apps?: unknown[] };
      if (!Array.isArray(parsed.apps)) return [];
      return parsed.apps.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const rec = item as Record<string, unknown>;
        if (typeof rec.name !== "string" || !rec.name.trim()) return [];
        const app: LaunchAppFact = { name: rec.name.trim() };
        if (typeof rec.type === "string") app.type = rec.type;
        if (typeof rec.cwd === "string") app.cwd = rec.cwd;
        if (typeof rec.command === "string") app.command = rec.command;
        if (typeof rec.port === "number") app.port = rec.port;
        return [app];
      });
    } catch {
      return [];
    }
  }
  return [];
}

function collectPackageJsonPaths(rootPath: string, prefix = ""): string[] {
  const paths: string[] = [];
  const rootPkg = path.join(rootPath, "package.json");
  if (fs.existsSync(rootPkg)) {
    paths.push(prefix ? `${prefix}/package.json` : "package.json");
  }
  const appsDir = path.join(rootPath, "apps");
  try {
    for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sub = path.join(appsDir, entry.name, "package.json");
      if (fs.existsSync(sub)) {
        const rel = prefix
          ? `${prefix}/apps/${entry.name}/package.json`
          : `apps/${entry.name}/package.json`;
        paths.push(rel);
      }
    }
  } catch {
    void 0;
  }
  return paths;
}

function readScripts(rootPath: string): string[] {
  const raw = readText(path.join(rootPath, "package.json"));
  if (!raw) return [];
  try {
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    return Object.keys(pkg.scripts ?? {}).sort();
  } catch {
    return [];
  }
}

function detectStackFromDeps(deps: Record<string, string>): string[] {
  const has = (n: string) => Object.prototype.hasOwnProperty.call(deps, n);
  const stacks: string[] = [];
  if (has("next")) stacks.push("next");
  else if (has("react") || has("react-dom")) stacks.push("react");
  if (has("vue") || has("nuxt")) stacks.push(has("nuxt") ? "nuxt" : "vue");
  if (has("@nestjs/core")) stacks.push("nestjs");
  else if (has("express")) stacks.push("express");
  else if (has("fastify")) stacks.push("fastify");
  if (has("prisma") || has("@prisma/client")) stacks.push("prisma");
  if (has("mongoose")) stacks.push("mongoose");
  return stacks;
}

function detectStack(rootPath: string): string[] {
  const raw = readText(path.join(rootPath, "package.json"));
  if (raw) {
    try {
      const pkg = JSON.parse(raw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const fromNode = detectStackFromDeps(deps);
      if (fromNode.length > 0) return fromNode;
    } catch {
      void 0;
    }
  }
  if (fs.existsSync(path.join(rootPath, "manage.py"))) return ["django"];
  if (fs.existsSync(path.join(rootPath, "pyproject.toml"))) {
    const py = readText(path.join(rootPath, "pyproject.toml")) ?? "";
    if (/fastapi/i.test(py)) return ["fastapi"];
    if (/flask/i.test(py)) return ["flask"];
    return ["python"];
  }
  if (fs.existsSync(path.join(rootPath, "requirements.txt"))) return ["python"];
  return [];
}

const ENV_EXAMPLE_FILES = [".env.example", ".env.sample", ".env.template"];

export function parseEnvExample(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function isLikelySecretKey(key: string): boolean {
  return /SECRET|PASSWORD|TOKEN|PRIVATE|API_KEY|DATABASE_URL|MONGODB_URI|CREDENTIAL/i.test(
    key
  );
}

function readEnvExampleValues(rootPath: string): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const name of ENV_EXAMPLE_FILES) {
    const text = readText(path.join(rootPath, name));
    if (!text) continue;
    Object.assign(merged, parseEnvExample(text));
  }
  return merged;
}

function sniffEnvKeys(rootPath: string, maxFiles = 40): string[] {
  const keys = new Set<string>();
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g,
    /os\.environ\[["']([A-Z][A-Z0-9_]*)["']\]/g,
    /os\.getenv\(["']([A-Z][A-Z0-9_]*)["']\)/g
  ];
  let scanned = 0;
  function walk(dir: string): void {
    if (scanned >= maxFiles) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (scanned >= maxFiles) break;
      if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") {
        continue;
      }
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx|mjs|cjs|py)$/i.test(e.name)) {
        continue;
      }
      scanned++;
      const text = readText(full);
      if (!text) continue;
      for (const re of patterns) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
          keys.add(m[1]!);
        }
      }
    }
  }
  walk(rootPath);
  return [...keys].sort();
}

import {
  collectEcosystemEvidence,
  suggestSkillsForFacts
} from "./repoFactsEcosystem.js";

export {
  collectEcosystemEvidence,
  factsHaveNodeEvidence,
  factsHavePythonEvidence,
  suggestSkillsForFacts
} from "./repoFactsEcosystem.js";

export function readRepoFactsFromHost(options: {
  rootPath: string;
  repoName?: string;
  analyzable?: boolean;
}): RepoFacts {
  const { rootPath, repoName } = options;
  const analyzable = options.analyzable ?? fs.existsSync(rootPath);
  if (!analyzable) {
    return {
      repoName,
      rootPath,
      analyzable: false,
      hasPackageJson: false,
      packageJsonPaths: [],
      scripts: [],
      launchApps: [],
      launchReady: false,
      detectedStack: [],
      suggestedSkills: [],
      envKeysFromSource: [],
      envKeysReferenced: [],
      envExampleValues: {},
      ecosystemEvidence: []
    };
  }
  const packageJsonPaths = collectPackageJsonPaths(rootPath, repoName);
  const scripts = readScripts(rootPath);
  const launchApps = peekLaunchApps(rootPath);
  const detectedStack = detectStack(rootPath);
  const envExampleValues = readEnvExampleValues(rootPath);
  const envKeysFromSource = sniffEnvKeys(rootPath);
  const envKeysReferenced = [
    ...new Set([...envKeysFromSource, ...Object.keys(envExampleValues)])
  ].sort();
  const packageManager = detectPackageManager(rootPath);
  const ecosystemEvidence = collectEcosystemEvidence(rootPath, {
    packageManager,
    packageJsonPaths
  });
  const facts: RepoFacts = {
    repoName,
    rootPath,
    analyzable: true,
    hasPackageJson: packageJsonPaths.length > 0,
    packageJsonPaths,
    packageManager,
    scripts,
    launchApps,
    launchReady: launchApps.length > 0,
    detectedStack,
    suggestedSkills: [],
    envKeysFromSource,
    envKeysReferenced,
    envExampleValues,
    ecosystemEvidence
  };
  facts.suggestedSkills = suggestSkillsForFacts(facts);
  return facts;
}
