export function parseGithubSlug(raw: string): {
  owner: string;
  repo: string;
} | null {
  let t = raw.trim();
  t = t
    .replace(/^https:\/\/github\.com\//i, "")
    .replace(/^git@github\.com:/i, "");
  t = t.replace(/\.git$/i, "");
  const m = t.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (!m) {
    return null;
  }
  return { owner: m[1]!, repo: m[2]! };
}
