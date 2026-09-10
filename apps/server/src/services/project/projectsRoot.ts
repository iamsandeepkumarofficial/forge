import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_FORGE_HOME = path.join(os.homedir(), ".forge");
const DEFAULT_PROJECTS_ROOT = path.join(DEFAULT_FORGE_HOME, "projects");
const DEFAULT_SESSIONS_ROOT = path.join(DEFAULT_FORGE_HOME, "sessions");
const DEFAULT_WORKSPACES_ROOT = path.join(DEFAULT_FORGE_HOME, "workspaces");

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

export function resolveWorkspacesRoot(): string {
  return resolveAbsoluteRoot(
    process.env.FORGE_WORKSPACES_ROOT,
    DEFAULT_WORKSPACES_ROOT
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

export function workspaceMemberDir(
  workspaceId: string,
  repoName: string
): string {
  return path.join(resolveWorkspacesRoot(), workspaceId, repoName);
}

export function workspaceSessionMemberDir(options: {
  workspaceId: string;
  sessionId: string;
  repoName: string;
}): string {
  return path.join(
    resolveWorkspacesRoot(),
    options.workspaceId,
    "sessions",
    options.sessionId,
    options.repoName
  );
}

export function workspaceSessionRoot(
  workspaceId: string,
  sessionId: string
): string {
  return path.join(resolveWorkspacesRoot(), workspaceId, "sessions", sessionId);
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

export async function ensureWorkspacesRoot(): Promise<string> {
  const root = resolveWorkspacesRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}
