const N_120 = 120;

export type SkillIndexEntry = {
  skillId: string;
  skillName: string;
  description: string;
};

function unquote(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, "");
}

function firstFrontmatterValue(block: string, key: string): string {
  const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const m = block.match(re);
  return m?.[1] ? unquote(m[1]) : "";
}

function firstParagraph(body: string): string {
  const cleaned = body
    .replace(/^---[\s\S]*?---/, "")
    .replace(/^#.+$/m, "")
    .trim();
  const para = cleaned.split(/\n\s*\n/)[0] ?? "";
  return para.replace(/\s+/g, " ").trim();
}

export function parseSkillPeek(options: {
  skillId: string;
  peek: string;
}): SkillIndexEntry {
  const peek = options.peek.replace(/^\uFEFF/, "");
  let skillName = options.skillId;
  let description = "";
  const fm = peek.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fm?.[1]) {
    const named = firstFrontmatterValue(fm[1], "name");
    const desc = firstFrontmatterValue(fm[1], "description");
    if (named) {
      skillName = named;
    }
    if (desc) {
      description = desc;
    }
  }
  if (!description) {
    const heading = peek.match(/^#\s+(.+)$/m);
    if (heading?.[1] && !fm) {
      skillName = heading[1].trim();
    }
    description = firstParagraph(peek);
  }
  if (description.length > N_120) {
    description = `${description.slice(0, N_120).trimEnd()}…`;
  }
  if (!description) {
    description = options.skillId;
  }
  return { skillId: options.skillId, skillName, description };
}
