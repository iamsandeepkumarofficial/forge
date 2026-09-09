import path from "node:path";
import { resolveSessionsRoot } from "../../services/project/projectsRoot.js";

const N_48 = 48;

export function sanitizeSessionFsName(sessionId: string): string {
  const cleaned = sessionId.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, N_48);
  return cleaned.replace(/^[._-]+/, "") || "session";
}

export function hostManagedSessionRoot(sessionId: string): string {
  return path.join(
    resolveSessionsRoot(),
    "_host",
    sanitizeSessionFsName(sessionId)
  );
}

export function isUnderHostManagedRoot(root: string): boolean {
  const base = path.resolve(path.join(resolveSessionsRoot(), "_host"));
  const resolved = path.resolve(root);
  return resolved === base || resolved.startsWith(`${base}${path.sep}`);
}
