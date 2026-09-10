export type SemVer = { major: number; minor: number; patch: number };

export function parseSemVer(raw: string): SemVer | null {
  const cleaned = raw.trim().replace(/^v/i, "");
  const m = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2] ?? 0),
    patch: Number(m[3] ?? 0)
  };
}

function cmp(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function satisfiesToken(version: SemVer, token: string): boolean {
  const t = token.trim();
  if (!t || t === "*" || /^lts\b/i.test(t)) return true;

  if (/^\d+\.x$/i.test(t)) {
    return version.major === Number(t.split(".")[0]);
  }

  if (t.startsWith("^")) {
    const ver = parseSemVer(t.slice(1));
    if (!ver) return false;
    const upper = { major: ver.major + 1, minor: 0, patch: 0 };
    return cmp(version, ver) >= 0 && cmp(version, upper) < 0;
  }

  if (t.startsWith("~")) {
    const ver = parseSemVer(t.slice(1));
    if (!ver) return false;
    const upper = { major: ver.major, minor: ver.minor + 1, patch: 0 };
    return cmp(version, ver) >= 0 && cmp(version, upper) < 0;
  }

  const m = t.match(/^(>=|<=|>|<|=)?\s*v?(\d+(?:\.\d+){0,2})$/i);
  if (!m) return false;
  const op = m[1] || "=";
  const ver = parseSemVer(m[2]!);
  if (!ver) return false;
  const c = cmp(version, ver);
  const bareMajor = !m[2]!.includes(".");
  switch (op) {
    case ">":
      return c > 0;
    case ">=":
      return c >= 0;
    case "<":
      return c < 0;
    case "<=":
      return c <= 0;
    default:
      return bareMajor ? version.major === ver.major : c === 0;
  }
}

export function versionSatisfiesRange(
  versionRaw: string,
  range: string
): boolean {
  const version = parseSemVer(versionRaw);
  if (!version) return false;
  const trimmed = range.trim();
  if (!trimmed || trimmed === "*") return true;

  return trimmed.split(/\s*\|\|\s*/).some((group) => {
    const tokens = group
      .trim()
      .match(
        /(?:>=|<=|>|<|=|\^|~)?\s*v?\d+(?:\.\d+){0,2}(?:\.x)?|\*|lts[^\s]*/gi
      );
    if (!tokens || tokens.length === 0) return false;
    return tokens.every((tok) => satisfiesToken(version, tok));
  });
}

export function formatSemVer(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}
