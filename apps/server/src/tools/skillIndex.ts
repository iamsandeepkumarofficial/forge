import fs from "node:fs";
import path from "node:path";
import {
  parseSkillPeek,
  peekAllPackagedSkills,
  readPackagedSkillBody,
  listPackagedSkillIds,
  type SkillIndexEntry
} from "@forge/skills";

const N_2048 = 2048;

const sessionSkillCache = new Map<string, SkillIndexEntry[]>();

export function getCachedSkillIndex(
  sessionId: string
): SkillIndexEntry[] | undefined {
  return sessionSkillCache.get(sessionId);
}

export function setCachedSkillIndex(
  sessionId: string,
  entries: SkillIndexEntry[]
): void {
  sessionSkillCache.set(sessionId, entries);
}

export function invalidateSkillIndex(sessionId: string): void {
  sessionSkillCache.delete(sessionId);
}

function peekSkillFile(options: {
  skillId: string;
  filePath: string;
}): SkillIndexEntry | null {
  try {
    const buf = fs.readFileSync(options.filePath);
    const peek = buf.subarray(0, Math.min(buf.length, N_2048)).toString("utf8");
    return parseSkillPeek({ skillId: options.skillId, peek });
  } catch {
    return null;
  }
}

function peekUserSkillsFromHost(workingDir: string): SkillIndexEntry[] {
  const skillsRoot = path.join(workingDir, ".forge", "skills");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: SkillIndexEntry[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) {
      continue;
    }
    if (e.isDirectory()) {
      const filePath = path.join(skillsRoot, e.name, "SKILL.md");
      const parsed = peekSkillFile({ skillId: e.name, filePath });
      if (parsed) {
        out.push(parsed);
      }
      continue;
    }
    if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
      const skillId = e.name.replace(/\.md$/i, "");
      const parsed = peekSkillFile({
        skillId,
        filePath: path.join(skillsRoot, e.name)
      });
      if (parsed) {
        out.push(parsed);
      }
    }
  }
  return out.sort((a, b) => a.skillId.localeCompare(b.skillId));
}

export function mergeSkillIndexes(
  packaged: SkillIndexEntry[],
  user: SkillIndexEntry[]
): SkillIndexEntry[] {
  const byId = new Map<string, SkillIndexEntry>();
  for (const e of packaged) {
    byId.set(e.skillId, e);
  }
  for (const e of user) {
    byId.set(e.skillId, e);
  }
  return [...byId.values()].sort((a, b) => a.skillId.localeCompare(b.skillId));
}

export function ensurePackagedSkillsInSession(workingDir: string): string[] {
  if (!workingDir || !fs.existsSync(workingDir)) {
    return [];
  }
  const destRoot = path.join(workingDir, ".forge", "skills");
  const copied: string[] = [];
  for (const skillId of listPackagedSkillIds()) {
    const destDir = path.join(destRoot, skillId, "SKILL.md");
    const destFlat = path.join(destRoot, `${skillId}.md`);
    if (fs.existsSync(destDir) || fs.existsSync(destFlat)) {
      continue;
    }
    const body = readPackagedSkillBody(skillId);
    if (!body) {
      continue;
    }
    try {
      fs.mkdirSync(path.dirname(destDir), { recursive: true });
      fs.writeFileSync(destDir, body, "utf8");
      copied.push(skillId);
    } catch {
      continue;
    }
  }
  return copied;
}

export function loadSkillIndexForPrompt(options: {
  sessionId?: string;
  workingDir: string;
}): SkillIndexEntry[] {
  ensurePackagedSkillsInSession(options.workingDir);
  const cached =
    options.sessionId != null
      ? getCachedSkillIndex(options.sessionId)
      : undefined;
  if (cached) {
    return cached;
  }
  const merged = mergeSkillIndexes(
    peekAllPackagedSkills(),
    peekUserSkillsFromHost(options.workingDir)
  );
  if (options.sessionId) {
    setCachedSkillIndex(options.sessionId, merged);
  }
  return merged;
}

export function formatSkillsPromptBlock(entries: SkillIndexEntry[]): string {
  if (entries.length === 0) {
    return "";
  }
  const lines = [
    "## Available skills",
    ...entries.map((e) => `- \`${e.skillId}\` — ${e.description}`)
  ];
  return lines.join("\n");
}

export function readSkillBodyFromHost(options: {
  workingDir: string;
  skillId: string;
}): string | null {
  const dirFile = path.join(
    options.workingDir,
    ".forge",
    "skills",
    options.skillId,
    "SKILL.md"
  );
  const flatFile = path.join(
    options.workingDir,
    ".forge",
    "skills",
    `${options.skillId}.md`
  );
  try {
    return fs.readFileSync(dirFile, "utf8");
  } catch {
    try {
      return fs.readFileSync(flatFile, "utf8");
    } catch {
      return readPackagedSkillBody(options.skillId);
    }
  }
}
