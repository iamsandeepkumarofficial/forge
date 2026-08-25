import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSkillPeek, type SkillIndexEntry } from "./parseSkillPeek.js";

const N_2048 = 2048;

export function packagedSkillsRoot(): string {
  return path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "bundled"
  );
}

export function listPackagedSkillIds(): string[] {
  const root = packagedSkillsRoot();
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export function peekPackagedSkill(skillId: string): SkillIndexEntry | null {
  const filePath = path.join(packagedSkillsRoot(), skillId, "SKILL.md");
  try {
    const buf = fs.readFileSync(filePath);
    const peek = buf.subarray(0, Math.min(buf.length, N_2048)).toString("utf8");
    return parseSkillPeek({ skillId, peek });
  } catch {
    return null;
  }
}

export function readPackagedSkillBody(skillId: string): string | null {
  const filePath = path.join(packagedSkillsRoot(), skillId, "SKILL.md");
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export function peekAllPackagedSkills(): SkillIndexEntry[] {
  const out: SkillIndexEntry[] = [];
  for (const id of listPackagedSkillIds()) {
    const entry = peekPackagedSkill(id);
    if (entry) {
      out.push(entry);
    }
  }
  return out;
}
