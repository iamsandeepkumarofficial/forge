import fs from "node:fs";
import path from "node:path";
import {
  collectEcosystemEvidence,
  detectPackageManager,
  detectRuntimeRequirements,
  detectStack,
  factsHaveNodeEvidence,
  factsHavePythonEvidence,
  suggestSkillsForFacts,
  type RuntimeRequirement,
  type StackEvidence
} from "./stacks/registry.js";

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

  runtimeRequirements: RuntimeRequirement[];
};

const LAUNCH_PATHS = [".forge/launch.json"];

function readText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export { detectPackageManager };

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

function toEcosystemEvidence(rows: StackEvidence[]): EcosystemEvidence[] {
  return rows.map((e) => ({
    ecosystem: e.ecosystem,
    manifests: e.manifests,
    lockfiles: e.lockfiles,
    packageManagerGuess: e.packageManagerGuess
  }));
}

export {
  collectEcosystemEvidence,
  factsHaveNodeEvidence,
  factsHavePythonEvidence,
  suggestSkillsForFacts
};

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
      ecosystemEvidence: [],
      runtimeRequirements: []
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
  const ecosystemEvidence = toEcosystemEvidence(
    collectEcosystemEvidence(rootPath)
  );
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
    ecosystemEvidence,
    runtimeRequirements: detectRuntimeRequirements(rootPath)
  };
  facts.suggestedSkills = suggestSkillsForFacts(facts);
  return facts;
}
