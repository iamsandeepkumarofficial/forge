import fs from "node:fs";
import path from "node:path";
import type {
  EcosystemEvidence,
  PackageManager,
  RepoFacts
} from "./repoFacts.js";

function readText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function collectPythonManifests(rootPath: string): string[] {
  const names = [
    "requirements.txt",
    "pyproject.toml",
    "Pipfile",
    "poetry.lock",
    "uv.lock",
    "manage.py"
  ];
  return names.filter((n) => fs.existsSync(path.join(rootPath, n)));
}

function collectGoManifests(rootPath: string): string[] {
  const names = ["go.mod", "go.sum"];
  return names.filter((n) => fs.existsSync(path.join(rootPath, n)));
}

function collectNodeLockfiles(rootPath: string): string[] {
  const names = [
    "pnpm-lock.yaml",
    "yarn.lock",
    "package-lock.json",
    "bun.lockb",
    "bun.lock"
  ];
  return names.filter((n) => fs.existsSync(path.join(rootPath, n)));
}

export function collectEcosystemEvidence(
  rootPath: string,
  options?: { packageManager?: PackageManager; packageJsonPaths?: string[] }
): EcosystemEvidence[] {
  const evidence: EcosystemEvidence[] = [];
  const pkgPaths = options?.packageJsonPaths?.length
    ? options.packageJsonPaths
    : fs.existsSync(path.join(rootPath, "package.json"))
      ? ["package.json"]
      : [];
  const nodeLocks = collectNodeLockfiles(rootPath);
  if (pkgPaths.length > 0 || nodeLocks.length > 0) {
    evidence.push({
      ecosystem: "node",
      manifests: pkgPaths.length > 0 ? pkgPaths : ["package.json"],
      lockfiles: nodeLocks,
      packageManagerGuess: options?.packageManager
    });
  }
  const py = collectPythonManifests(rootPath);
  if (py.length > 0) {
    let pmGuess: string | undefined;
    if (py.includes("poetry.lock") || py.includes("pyproject.toml")) {
      const toml = readText(path.join(rootPath, "pyproject.toml")) ?? "";
      if (/\[tool\.poetry\]/i.test(toml) || py.includes("poetry.lock")) {
        pmGuess = "poetry";
      } else if (py.includes("uv.lock") || /\[tool\.uv\]/i.test(toml)) {
        pmGuess = "uv";
      } else {
        pmGuess = "pip";
      }
    } else if (py.includes("Pipfile")) {
      pmGuess = "pipenv";
    } else if (py.includes("requirements.txt")) {
      pmGuess = "pip";
    }
    evidence.push({
      ecosystem: "python",
      manifests: py,
      lockfiles: py.filter((p) =>
        ["poetry.lock", "uv.lock", "Pipfile.lock"].includes(p)
      ),
      packageManagerGuess: pmGuess
    });
  }
  const go = collectGoManifests(rootPath);
  if (go.length > 0) {
    evidence.push({
      ecosystem: "go",
      manifests: go,
      lockfiles: go.filter((p) => p === "go.sum"),
      packageManagerGuess: "go"
    });
  }
  return evidence;
}

export function factsHaveNodeEvidence(facts: RepoFacts): boolean {
  return facts.ecosystemEvidence.some((e) => e.ecosystem === "node");
}

export function factsHavePythonEvidence(facts: RepoFacts): boolean {
  return (
    facts.ecosystemEvidence.some((e) => e.ecosystem === "python") ||
    facts.detectedStack.some((s) =>
      ["django", "fastapi", "flask", "python"].includes(s)
    )
  );
}

export function suggestSkillsForFacts(facts: RepoFacts): string[] {
  const skills = new Set<string>();
  const stacks = facts.detectedStack;
  if (stacks.includes("next")) skills.add("nextjs-app");
  else if (stacks.includes("react")) skills.add("reactjs-app");
  if (stacks.includes("vue") || stacks.includes("nuxt"))
    skills.add("vuejs-app");
  const isFrontend =
    stacks.some((s) => ["next", "react", "vue", "nuxt", "vite"].includes(s)) ||
    facts.scripts.includes("dev");
  const isBackend =
    stacks.some((s) =>
      [
        "express",
        "fastify",
        "nestjs",
        "django",
        "fastapi",
        "flask",
        "python"
      ].includes(s)
    ) || facts.scripts.includes("start");
  if (isFrontend) skills.add("frontend-app");
  if (isBackend) skills.add("backend-app");
  if (facts.hasPackageJson && facts.packageManager) skills.add("nodejs-app");
  if (
    stacks.some((s) => ["django", "fastapi", "flask", "python"].includes(s))
  ) {
    skills.add("python-app");
  }
  if (
    stacks.includes("prisma") ||
    stacks.includes("mongoose") ||
    facts.envKeysReferenced.some((k) =>
      ["DATABASE_URL", "MONGODB_URI", "REDIS_URL"].includes(k)
    )
  ) {
    skills.add("db-migrations");
  }
  return [...skills].sort();
}
