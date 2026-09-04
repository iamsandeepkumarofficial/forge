import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_FORGE_HOME = path.join(os.homedir(), ".forge");
const DEFAULT_PROJECTS_ROOT = path.join(DEFAULT_FORGE_HOME, "projects");
const DEFAULT_SESSIONS_ROOT = path.join(DEFAULT_FORGE_HOME, "sessions");

function expandHome(raw: string): string {
  if (raw.startsWith("~/")) {
    return path.resolve(os.homedir(), raw.slice(2));
  }
  if (raw === "~") {
    return os.homedir();
  }
  return raw;
}

function resolveAbsoluteRoot(
  envValue: string | undefined,
  fallback: string
): string {
  const raw = envValue?.trim();
  if (!raw) {
    return fallback;
  }
  const expanded = expandHome(raw);
  return path.isAbsolute(expanded)
    ? expanded
    : path.resolve(process.cwd(), expanded);
}


export function resolveProjectsRoot(): string {
  return resolveAbsoluteRoot(
    process.env.FORGE_PROJECTS_ROOT,
    DEFAULT_PROJECTS_ROOT
  );
}


export function resolveSessionsRoot(): string {
  return resolveAbsoluteRoot(
    process.env.FORGE_SESSIONS_ROOT,
    DEFAULT_SESSIONS_ROOT
  );
}

export function projectCanonicalDir(projectId: string): string {
  return path.join(resolveProjectsRoot(), projectId);
}

export function sessionWorktreeDir(
  projectId: string,
  sessionId: string
): string {
  return path.join(resolveSessionsRoot(), projectId, sessionId);
}

export async function ensureProjectsRoot(): Promise<string> {
  const root = resolveProjectsRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}

export async function ensureSessionsRoot(): Promise<string> {
  const root = resolveSessionsRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}
