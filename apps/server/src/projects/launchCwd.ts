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
  const repo = String(options.repoDir || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (repo && rel === repo) {
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
  workingDir: string;
  repoDir: string;
  cwd: string;
}): Promise<{ appDir: string; relCwd: string; error?: string }> {
  const rel = safeRelDir(options.cwd || ".") || ".";
  const primary = appDirForCwd({ workingDir: options.workingDir, relCwd: rel });
  if (await pathExistsInSandbox(options.containerName, primary)) {
    return { appDir: primary, relCwd: rel === "." ? "." : rel };
  }
  const repo = String(options.repoDir || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (
    repo &&
    rel === repo &&
    (await pathExistsInSandbox(options.containerName, options.workingDir))
  ) {
    return { appDir: options.workingDir, relCwd: "." };
  }
  return {
    appDir: primary,
    relCwd: rel,
    error: `App cwd not found: ${primary} (launch cwd="${options.cwd}"). Use "." for the repo root.`
  };
}
