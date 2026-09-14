import fs from "node:fs";
import path from "node:path";
import { firstNonEmptyLine, readText } from "../fs.js";
import type {
  RuntimeRequirement,
  StackAdapter,
  StackEvidence,
  StackFactsView
} from "../types.js";

const PY_MANIFESTS = [
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "poetry.lock",
  "uv.lock",
  "manage.py"
];

function collectPythonManifests(rootPath: string): string[] {
  return PY_MANIFESTS.filter((n) => fs.existsSync(path.join(rootPath, n)));
}

function packageManagerGuess(
  py: string[],
  rootPath: string
): string | undefined {
  if (py.includes("poetry.lock") || py.includes("pyproject.toml")) {
    const toml = readText(path.join(rootPath, "pyproject.toml")) ?? "";
    if (/\[tool\.poetry\]/i.test(toml) || py.includes("poetry.lock")) {
      return "poetry";
    }
    if (py.includes("uv.lock") || /\[tool\.uv\]/i.test(toml)) {
      return "uv";
    }
    return "pip";
  }
  if (py.includes("Pipfile")) return "pipenv";
  if (py.includes("requirements.txt")) return "pip";
  return undefined;
}

export const pythonStackAdapter: StackAdapter = {
  id: "python",
  label: "Python",
  hostBinary: "python3",
  skillId: "python-app",

  collectEvidence(rootPath: string): StackEvidence | null {
    const py = collectPythonManifests(rootPath);
    if (py.length === 0) return null;
    return {
      ecosystem: "python",
      manifests: py,
      lockfiles: py.filter((p) =>
        ["poetry.lock", "uv.lock", "Pipfile.lock"].includes(p)
      ),
      packageManagerGuess: packageManagerGuess(py, rootPath)
    };
  },

  detectRequirement(rootPath: string): RuntimeRequirement | null {
    const pyVer = readText(path.join(rootPath, ".python-version"));
    if (pyVer) {
      const line = firstNonEmptyLine(pyVer);
      if (line) {
        return { tool: "python", range: line, source: ".python-version" };
      }
    }
    const toml = readText(path.join(rootPath, "pyproject.toml"));
    if (toml) {
      const m =
        toml.match(/requires-python\s*=\s*["']([^"']+)["']/) ||
        toml.match(/\[project\][\s\S]*?requires-python\s*=\s*["']([^"']+)["']/);
      if (m?.[1]) {
        return {
          tool: "python",
          range: m[1].trim(),
          source: "pyproject.toml requires-python"
        };
      }
    }
    return null;
  },

  detectStackTags(rootPath: string): string[] {
    if (fs.existsSync(path.join(rootPath, "manage.py"))) return ["django"];
    if (fs.existsSync(path.join(rootPath, "pyproject.toml"))) {
      const py = readText(path.join(rootPath, "pyproject.toml")) ?? "";
      if (/fastapi/i.test(py)) return ["fastapi"];
      if (/flask/i.test(py)) return ["flask"];
      return ["python"];
    }
    if (fs.existsSync(path.join(rootPath, "requirements.txt"))) {
      return ["python"];
    }
    return [];
  },

  suggestSkills(facts: StackFactsView): string[] {
    if (!pythonStackAdapter.matchesFacts(facts)) return [];
    const skills = new Set<string>(["python-app"]);
    const stacks = facts.detectedStack ?? [];
    if (
      stacks.some((s) => ["django", "fastapi", "flask", "python"].includes(s))
    ) {
      skills.add("backend-app");
    }
    return [...skills];
  },

  installGap(rootPath: string): string | null {
    if (!fs.existsSync(rootPath)) return null;
    const hasVenv =
      fs.existsSync(path.join(rootPath, ".venv")) ||
      fs.existsSync(path.join(rootPath, "venv"));
    if (!hasVenv) {
      return "Python env may be missing (no .venv) — invoke python-app via workspace-readiness";
    }
    return null;
  },

  probe: {
    argv: ["python3", "--version"],
    parse(stdout: string): string | null {
      const m = stdout.match(/(\d+\.\d+\.\d+|\d+\.\d+)/);
      return m?.[1] ?? null;
    }
  },

  matchesFacts(facts: StackFactsView): boolean {
    return (
      facts.ecosystemEvidence.some((e) => e.ecosystem === "python") ||
      (facts.detectedStack ?? []).some((s) =>
        ["django", "fastapi", "flask", "python"].includes(s)
      )
    );
  }
};
