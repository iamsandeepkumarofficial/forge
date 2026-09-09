import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  rm,
  stat,
  symlink
} from "node:fs/promises";
import { homedir, platform as osPlatform } from "node:os";
import { basename, dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import {
  currentHostArch,
  getProjectInfraDependency,
  listProjectInfraDependencyIds,
  type ProjectInfraDependency
} from "./registry.js";
import {
  forgeRuntimeBin,
  forgeRuntimeDownloads,
  forgeRuntimeExtract
} from "./paths.js";

const execFileAsync = promisify(execFile);
const N_755 = 0o755;

export type InstallProjectInfraResult = {
  dependencyId: string;
  version: string;
  reused: boolean;
  binDir: string;
  binaries: Record<string, string>;
};

export type InstallProjectInfraDeps = {
  home?: string;
  platform?: NodeJS.Platform;
  arch?: string;
  fetchImpl?: typeof fetch;
};

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function binariesPresent(
  dep: ProjectInfraDependency,
  binDir: string
): Promise<boolean> {
  for (const name of dep.binaries) {
    if (!(await pathExists(join(binDir, name)))) return false;
  }
  return true;
}

async function downloadToFile(options: {
  url: string;
  dest: string;
  fetchImpl: typeof fetch;
}): Promise<void> {
  const res = await options.fetchImpl(options.url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}): ${options.url}`);
  }
  await mkdir(dirname(options.dest), { recursive: true });
  const body = Readable.fromWeb(
    res.body as import("node:stream/web").ReadableStream
  );
  await pipeline(body, createWriteStream(options.dest));
}

async function extractArchive(
  archivePath: string,
  extractDir: string
): Promise<void> {
  await mkdir(extractDir, { recursive: true });
  await execFileAsync("tar", ["-xzf", archivePath, "-C", extractDir]);
}

async function walkFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const ent of entries) {
    const full = join(root, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else if (ent.isFile() || ent.isSymbolicLink()) {
      out.push(full);
    }
  }
  return out;
}

async function linkBinaries(options: {
  dep: ProjectInfraDependency;
  extractDir: string;
  binDir: string;
}): Promise<Record<string, string>> {
  const files = await walkFiles(options.extractDir);
  const byBase = new Map<string, string>();
  for (const f of files) {
    byBase.set(basename(f), f);
  }
  await mkdir(options.binDir, { recursive: true });
  const linked: Record<string, string> = {};
  for (const name of options.dep.binaries) {
    const src = byBase.get(name);
    if (!src) {
      throw new Error(
        `Archive for ${options.dep.id} did not contain binary \`${name}\` after extract.`
      );
    }
    const dest = join(options.binDir, name);
    await rm(dest, { force: true });
    try {
      await symlink(src, dest);
    } catch {
      await copyFile(src, dest);
      await chmod(dest, N_755);
    }
    linked[name] = dest;
  }
  return linked;
}

export async function installProjectInfraDependency(
  dependencyId: string,
  options: InstallProjectInfraDeps & { version?: string } = {}
): Promise<InstallProjectInfraResult> {
  const dep = getProjectInfraDependency(dependencyId);
  if (!dep) {
    throw new Error(
      `Unknown dependencyId \`${dependencyId}\`. Known: ${listProjectInfraDependencyIds().join(", ") || "(none)"}.`
    );
  }
  const home = options.home ?? homedir();
  const plat = options.platform ?? osPlatform();
  const arch = options.arch ?? currentHostArch();
  const binDir = forgeRuntimeBin(home);

  if (await binariesPresent(dep, binDir)) {
    const binaries: Record<string, string> = {};
    for (const name of dep.binaries) {
      binaries[name] = join(binDir, name);
    }
    const archive = dep.resolveArchive({
      platform: plat,
      arch,
      version: options.version
    });
    return {
      dependencyId: dep.id,
      version: archive?.version ?? "installed",
      reused: true,
      binDir,
      binaries
    };
  }

  const archive = dep.resolveArchive({
    platform: plat,
    arch,
    version: options.version
  });
  if (!archive) {
    throw new Error(
      `No tarball installer for ${dep.label} on ${plat}/${arch}. Install manually onto PATH or ~/.forge/runtime/bin/.`
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const downloads = forgeRuntimeDownloads(home);
  const extractRoot = join(forgeRuntimeExtract(home), dep.id);
  await mkdir(downloads, { recursive: true });
  await rm(extractRoot, { recursive: true, force: true });
  await mkdir(extractRoot, { recursive: true });

  const archivePath = join(downloads, archive.fileName);
  if (!(await pathExists(archivePath))) {
    await downloadToFile({
      url: archive.url,
      dest: archivePath,
      fetchImpl
    });
  }

  await extractArchive(archivePath, extractRoot);
  const binaries = await linkBinaries({
    dep,
    extractDir: extractRoot,
    binDir
  });
  return {
    dependencyId: dep.id,
    version: archive.version,
    reused: false,
    binDir,
    binaries
  };
}
