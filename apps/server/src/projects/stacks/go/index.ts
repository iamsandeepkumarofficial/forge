import fs from "node:fs";
import path from "node:path";
import { readText } from "../fs.js";
import { formatSemVer, parseSemVer } from "../../versionSatisfy.js";
import type {
  RuntimeRequirement,
  StackAdapter,
  StackEvidence,
  StackFactsView
} from "../types.js";

export const goStackAdapter: StackAdapter = {
  id: "go",
  label: "Go",
  hostBinary: "go",
  skillId: null,

  collectEvidence(rootPath: string): StackEvidence | null {
    const names = ["go.mod", "go.sum"];
    const go = names.filter((n) => fs.existsSync(path.join(rootPath, n)));
    if (go.length === 0) return null;
    return {
      ecosystem: "go",
      manifests: go,
      lockfiles: go.filter((p) => p === "go.sum"),
      packageManagerGuess: "go"
    };
  },

  detectRequirement(rootPath: string): RuntimeRequirement | null {
    const mod = readText(path.join(rootPath, "go.mod"));
    if (!mod) return null;
    const m = mod.match(/^go\s+(\d+(?:\.\d+){0,2})\s*$/m);
    if (!m?.[1]) return null;
    return {
      tool: "go",
      range: `>=${m[1]}`,
      source: "go.mod"
    };
  },

  detectStackTags(rootPath: string): string[] {
    if (fs.existsSync(path.join(rootPath, "go.mod"))) return ["go"];
    return [];
  },

  suggestSkills(_facts: StackFactsView): string[] {
    return [];
  },

  installGap(_rootPath: string): string | null {
    return null;
  },

  probe: {
    argv: ["go", "version"],
    parse(stdout: string): string | null {
      const m = stdout.match(/go(\d+\.\d+(?:\.\d+)?)/i);
      if (!m?.[1]) return null;
      const ver = parseSemVer(m[1]);
      return ver ? formatSemVer(ver) : m[1];
    }
  },

  matchesFacts(facts: StackFactsView): boolean {
    return (
      facts.ecosystemEvidence.some((e) => e.ecosystem === "go") ||
      (facts.detectedStack ?? []).includes("go")
    );
  }
};
