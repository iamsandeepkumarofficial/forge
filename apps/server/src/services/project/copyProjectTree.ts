import fs from "node:fs/promises";
import path from "node:path";

const SKIP_DIR_SEGMENTS = new Set([
  "node_modules",
  // Keep .git so canonical local copies remain real repos (RFC 0005).
  ".svn",
  ".hg",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "coverage",
  "__MACOSX",
  ".turbo",
  ".vercel",
  ".cache",
  ".output"
]);

const SKIP_FILE_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

function shouldSkipName(name: string, isDirectory: boolean): boolean {
  if (isDirectory && SKIP_DIR_SEGMENTS.has(name)) return true;
  if (!isDirectory && SKIP_FILE_NAMES.has(name)) return true;
  return false;
}

/**
 * Copy a project tree into destDir, skipping heavy/generated directories.
 * Does not follow symlinks outside the source (copies link targets as files when possible).
 */
export async function copyProjectTree(
  sourceDir: string,
  destDir: string
): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  await copyRecursive(sourceDir, destDir);
}

async function copyRecursive(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkipName(entry.name, entry.isDirectory())) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(to, { recursive: true });
      await copyRecursive(from, to);
    } else if (entry.isSymbolicLink()) {
      try {
        const target = await fs.readlink(from);
        await fs.symlink(target, to);
      } catch {
        await fs.copyFile(from, to);
      }
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}
