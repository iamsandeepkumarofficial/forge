import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { REPO_WALK_LIMIT } from "./types.js";

export type RepoRootOptions = {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  startDirs?: string[];
};

export function findRepoRoot(options: RepoRootOptions = {}): string {
  const env = options.env ?? process.env;
  const override = env.FORGE_REPO_ROOT?.trim();
  if (override && isDir(override)) return resolve(override);

  const starts = options.startDirs?.length
    ? options.startDirs
    : [options.cwd ?? process.cwd()];
  for (const start of starts) {
    const found = walkForRoot(start);
    if (found) return found;
  }
  throw new Error("Could not locate Forge repository root (set FORGE_REPO_ROOT)");
}

function walkForRoot(start: string): string | null {
  let dir = resolve(start);
  for (let i = 0; i < REPO_WALK_LIMIT; i += 1) {
    if (isRepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function isRepoRoot(dir: string): boolean {
  return (
    existsSync(join(dir, "pnpm-workspace.yaml")) ||
    existsSync(join(dir, "docker-compose.yml"))
  );
}

function isDir(path: string): boolean {
  return existsSync(path);
}
