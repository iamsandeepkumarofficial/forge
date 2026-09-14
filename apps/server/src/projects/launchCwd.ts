import { pathExistsInSandbox } from "./sandboxExec.js";

export function safeRelDir(cwd: string): string {
  const cleaned = String(cwd || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (cleaned.split("/").some((s) => s === "..")) {
    throw new Error(`Unsafe app cwd: ${cwd}`);
  }
  return cleaned;
}

export function normalizeLaunchCwd(options: {
  cwd: string;
  repoDir: string;
}): string {
  const rel = safeRelDir(options.cwd || ".") || ".";
  if (rel === ".") {
    return ".";
  }
  return rel;
}

export function appDirForCwd(options: {
  workingDir: string;
  relCwd: string;
}): string {
  if (!options.relCwd || options.relCwd === ".") {
    return options.workingDir;
  }
  return `${options.workingDir}/${options.relCwd}`;
}

export async function resolveLaunchAppDir(options: {
  containerName: string;
  sessionId: string;
  workingDir: string;
  repoDir: string;
  cwd: string;
}): Promise<{ appDir: string; relCwd: string; error?: string }> {
  const rel = safeRelDir(options.cwd || ".") || ".";
  const primary = appDirForCwd({ workingDir: options.workingDir, relCwd: rel });
  if (
    await pathExistsInSandbox({
      container: options.containerName,
      absPath: primary,
      sessionId: options.sessionId
    })
  ) {
    return { appDir: primary, relCwd: rel === "." ? "." : rel };
  }
  return {
    appDir: primary,
    relCwd: rel,
    error: `App cwd not found: ${primary} (launch cwd="${options.cwd}"). Use "${options.repoDir || "."}" for the repo root.`
  };
}
