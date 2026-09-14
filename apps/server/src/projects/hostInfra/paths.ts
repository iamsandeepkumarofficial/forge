import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function forgeRuntimeRoot(home = homedir()): string {
  return join(home, ".forge", "runtime");
}

export function forgeRuntimeBin(home = homedir()): string {
  return join(forgeRuntimeRoot(home), "bin");
}

export function forgeRuntimeDownloads(home = homedir()): string {
  return join(forgeRuntimeRoot(home), "downloads");
}

export function forgeRuntimeExtract(home = homedir()): string {
  return join(forgeRuntimeRoot(home), "extract");
}

export function forgeRuntimeDepRoot(
  dependencyId: string,
  home = homedir()
): string {
  return join(forgeRuntimeRoot(home), dependencyId);
}

export function forgeRuntimeDepVersion(options: {
  dependencyId: string;
  version: string;
  home?: string;
}): string {
  return join(
    forgeRuntimeDepRoot(options.dependencyId, options.home ?? homedir()),
    options.version
  );
}

export function forgeRuntimeDepCurrent(
  dependencyId: string,
  home = homedir()
): string {
  return join(forgeRuntimeDepRoot(dependencyId, home), "current");
}

export function forgeRuntimeBinDirs(home = homedir()): string[] {
  const root = forgeRuntimeRoot(home);
  const dirs: string[] = [];
  try {
    for (const ent of readdirSync(root, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      if (
        ent.name === "bin" ||
        ent.name === "downloads" ||
        ent.name === "extract"
      ) {
        continue;
      }
      const bin = join(root, ent.name, "current", "bin");
      if (existsSync(bin)) dirs.push(bin);
    }
  } catch {
    void 0;
  }
  const legacy = forgeRuntimeBin(home);
  if (existsSync(legacy)) dirs.push(legacy);
  return dirs;
}

export function withForgeRuntimePath(
  pathEnv: string | undefined,
  home = homedir()
): string {
  const delimiter = process.platform === "win32" ? ";" : ":";
  const existing = (pathEnv ?? "").split(delimiter).filter(Boolean);
  const forge = forgeRuntimeBinDirs(home);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of [...forge, ...existing]) {
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out.join(delimiter);
}
