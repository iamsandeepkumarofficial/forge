import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_FORGE_HOME = path.join(os.homedir(), ".forge");
const DEFAULT_PROJECTS_ROOT = path.join(DEFAULT_FORGE_HOME, "projects");

function expandHome(raw: string): string {
  if (raw.startsWith("~/")) {
    return path.resolve(os.homedir(), raw.slice(2));
  }
  if (raw === "~") {
    return os.homedir();
  }
  return raw;
}

/** Canonical project copies live under ~/.forge/projects (RFC 0004). */
export function resolveProjectsRoot(): string {
  const raw = process.env.FORGE_PROJECTS_ROOT?.trim();
  if (!raw) {
    return DEFAULT_PROJECTS_ROOT;
  }
  const expanded = expandHome(raw);
  return path.isAbsolute(expanded)
    ? expanded
    : path.resolve(process.cwd(), expanded);
}

export function projectCanonicalDir(projectId: string): string {
  return path.join(resolveProjectsRoot(), projectId);
}

export async function ensureProjectsRoot(): Promise<string> {
  const root = resolveProjectsRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}
