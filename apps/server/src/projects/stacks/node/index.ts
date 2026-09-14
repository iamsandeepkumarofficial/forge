import fs from "node:fs";
import path from "node:path";
import { firstNonEmptyLine, readText } from "../fs.js";
import type {
  RuntimeRequirement,
  StackAdapter,
  StackEvidence,
  StackFactsView
} from "../types.js";
import { nodeInstallFacet } from "./install.js";

export type PackageManager = "pnpm" | "yarn" | "npm" | "bun";

function collectPackageJsonRels(rootPath: string): string[] {
  const paths: string[] = [];
  if (fs.existsSync(path.join(rootPath, "package.json"))) {
    paths.push("package.json");
  }
  const appsDir = path.join(rootPath, "apps");
  try {
    for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (fs.existsSync(path.join(appsDir, entry.name, "package.json"))) {
        paths.push(`apps/${entry.name}/package.json`);
      }
    }
  } catch {
    void 0;
  }
  return paths;
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

function parseNodeFromPackageJson(rootPath: string): RuntimeRequirement | null {
  const raw = readText(path.join(rootPath, "package.json"));
  if (!raw) return null;
  try {
    const pkg = JSON.parse(raw) as {
      engines?: { node?: string };
      volta?: { node?: string };
    };
    if (typeof pkg.volta?.node === "string" && pkg.volta.node.trim()) {
      return {
        tool: "node",
        range: pkg.volta.node.trim(),
        source: "package.json volta.node"
      };
    }
    if (typeof pkg.engines?.node === "string" && pkg.engines.node.trim()) {
      return {
        tool: "node",
        range: pkg.engines.node.trim(),
        source: "package.json engines.node"
      };
    }
  } catch {
    return null;
  }
  return null;
}

function parseNodeFromDotfiles(rootPath: string): RuntimeRequirement | null {
  for (const name of [".nvmrc", ".node-version"]) {
    const raw = readText(path.join(rootPath, name));
    if (!raw) continue;
    const line = firstNonEmptyLine(raw);
    if (line) {
      return { tool: "node", range: line.replace(/^v/i, ""), source: name };
    }
  }
  const toolVersions = readText(path.join(rootPath, ".tool-versions"));
  if (toolVersions) {
    for (const line of toolVersions.split("\n")) {
      const m = line.trim().match(/^(?:nodejs|node)\s+(\S+)/i);
      if (m?.[1]) {
        return {
          tool: "node",
          range: m[1].replace(/^v/i, ""),
          source: ".tool-versions"
        };
      }
    }
  }
  return null;
}

const NEXT_MAJOR_15 = 15;
const NEXT_MAJOR_14 = 14;
const NEXT_MAJOR_13 = 13;
const NEXT_MAJOR_12 = 12;
const TYPES_NODE_MIN_MAJOR = 14;

function parseMajorFromDepRange(raw: string): number | null {
  const m = raw.trim().match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export function inferNodeRequirementFromPackageJson(
  rootPath: string
): RuntimeRequirement | null {
  const raw = readText(path.join(rootPath, "package.json"));
  if (!raw) return null;
  try {
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const nextRange = deps.next;
    if (typeof nextRange === "string") {
      const major = parseMajorFromDepRange(nextRange);
      if (major != null) {
        if (major >= NEXT_MAJOR_15) {
          return {
            tool: "node",
            range: ">=18.18 <24",
            source: `inferred from next@${nextRange}`
          };
        }
        if (major >= NEXT_MAJOR_14) {
          return {
            tool: "node",
            range: ">=18.17 <23",
            source: `inferred from next@${nextRange}`
          };
        }
        if (major >= NEXT_MAJOR_13) {
          return {
            tool: "node",
            range: ">=16.14 <22",
            source: `inferred from next@${nextRange}`
          };
        }
        if (major >= NEXT_MAJOR_12) {
          return {
            tool: "node",
            range: ">=12.22 <19",
            source: `inferred from next@${nextRange}`
          };
        }
      }
    }
    const typesNode = deps["@types/node"];
    if (typeof typesNode === "string") {
      const major = parseMajorFromDepRange(typesNode);
      if (major != null && major >= TYPES_NODE_MIN_MAJOR) {
        return {
          tool: "node",
          range: `>=${major} <${major + 1}`,
          source: `inferred from @types/node@${typesNode}`
        };
      }
    }
  } catch {
    return null;
  }
  return null;
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
  if (has("vite")) stacks.push("vite");
  return stacks;
}

export const nodeStackAdapter: StackAdapter = {
  id: "node",
  label: "Node.js",
  hostBinary: "node",
  skillId: "nodejs-app",
  install: nodeInstallFacet,

  collectEvidence(rootPath: string): StackEvidence | null {
    const pkgPaths = collectPackageJsonRels(rootPath);
    const nodeLocks = collectNodeLockfiles(rootPath);
    if (pkgPaths.length === 0 && nodeLocks.length === 0) return null;
    const pm = detectPackageManager(rootPath);
    return {
      ecosystem: "node",
      manifests: pkgPaths.length > 0 ? pkgPaths : ["package.json"],
      lockfiles: nodeLocks,
      packageManagerGuess: pm
    };
  },

  detectRequirement(rootPath: string): RuntimeRequirement | null {
    return (
      parseNodeFromDotfiles(rootPath) ??
      parseNodeFromPackageJson(rootPath) ??
      inferNodeRequirementFromPackageJson(rootPath)
    );
  },

  detectStackTags(rootPath: string): string[] {
    const raw = readText(path.join(rootPath, "package.json"));
    if (!raw) return [];
    try {
      const pkg = JSON.parse(raw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return detectStackFromDeps(deps);
    } catch {
      return [];
    }
  },

  suggestSkills(facts: StackFactsView): string[] {
    if (!nodeStackAdapter.matchesFacts(facts)) return [];
    const skills = new Set<string>();
    const stacks = facts.detectedStack ?? [];
    if (stacks.includes("next")) skills.add("nextjs-app");
    else if (stacks.includes("react")) skills.add("reactjs-app");
    if (stacks.includes("vue") || stacks.includes("nuxt")) {
      skills.add("vuejs-app");
    }
    const isFrontend =
      stacks.some((s) =>
        ["next", "react", "vue", "nuxt", "vite"].includes(s)
      ) || (facts.scripts ?? []).includes("dev");
    const isBackend =
      stacks.some((s) => ["express", "fastify", "nestjs"].includes(s)) ||
      (facts.scripts ?? []).includes("start");
    if (isFrontend) skills.add("frontend-app");
    if (isBackend) skills.add("backend-app");
    if (
      facts.hasPackageJson ||
      facts.packageManager ||
      nodeStackAdapter.matchesFacts(facts)
    ) {
      skills.add("nodejs-app");
    }
    return [...skills];
  },

  installGap(rootPath: string): string | null {
    if (!fs.existsSync(rootPath)) return null;
    if (!fs.existsSync(path.join(rootPath, "node_modules"))) {
      return "deps not installed (no node_modules) — invoke stack skill via workspace-readiness";
    }
    return null;
  },

  probe: {
    argv: ["node", "-v"],
    parse(stdout: string): string | null {
      const m = stdout.match(/v?(\d+\.\d+\.\d+)/);
      return m?.[1] ?? null;
    }
  },

  matchesFacts(facts: StackFactsView): boolean {
    return (
      facts.hasPackageJson === true ||
      facts.ecosystemEvidence.some((e) => e.ecosystem === "node")
    );
  }
};
