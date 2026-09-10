import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
  chmod,
  mkdir,
  readdir,
  readlink,
  rename,
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
  dependencyIdAliasHint,
  getProjectInfraDependency,
  listProjectInfraDependencyIds,
  type ProjectInfraDependency
} from "./registry.js";
import {
  forgeRuntimeDepCurrent,
  forgeRuntimeDepVersion,
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
  installRoot: string;
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

async function resolveExtractPayload(extractDir: string): Promise<string> {
  const entries = await readdir(extractDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length === 1 && entries.length === 1) {
    return join(extractDir, dirs[0]!.name);
  }
  return extractDir;
}

async function ensureBinDir(options: {
  dep: ProjectInfraDependency;
  root: string;
}): Promise<string> {
  const binRel = options.dep.binRelative ?? "bin";
  const binDir = join(options.root, binRel);
  const needed = options.dep.binaries;
  const allPresent = async () => {
    for (const name of needed) {
      if (!(await pathExists(join(binDir, name)))) return false;
    }
    return true;
  };
  if ((await pathExists(binDir)) && (await allPresent())) {
    return binDir;
  }

  const files = await walkFiles(options.root);
  const byBase = new Map<string, string>();
  for (const f of files) {
    byBase.set(basename(f), f);
  }
  await mkdir(binDir, { recursive: true });
  for (const name of needed) {
    const src = byBase.get(name);
    if (!src) {
      throw new Error(
        `Archive for ${options.dep.id} did not contain binary \`${name}\` after extract.`
      );
    }
    const dest = join(binDir, name);
    if (src === dest) continue;
    await rm(dest, { force: true });
    try {
      await symlink(src, dest);
    } catch {
      const { copyFile } = await import("node:fs/promises");
      await copyFile(src, dest);
      await chmod(dest, N_755);
    }
  }
  return binDir;
}

async function probeVersion(binaryPath: string): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, ["-v"], {
      timeout: 5000
    });
    const text = `${stdout}\n${stderr}`;
    const m = text.match(/v?(\d+\.\d+\.\d+)/);
    return m?.[1] ?? null;
  } catch {
    try {
      const { stdout, stderr } = await execFileAsync(
        binaryPath,
        ["--version"],
        { timeout: 5000 }
      );
      const text = `${stdout}\n${stderr}`;
      const m = text.match(/v?(\d+\.\d+\.\d+)/);
      return m?.[1] ?? null;
    } catch {
      return null;
    }
  }
}

async function canReuse(options: {
  dep: ProjectInfraDependency;
  versionRoot: string;
  expectedVersion: string;
}): Promise<boolean> {
  const binDir = join(options.versionRoot, options.dep.binRelative ?? "bin");
  const probe = join(binDir, options.dep.probeBinary);
  if (!(await pathExists(probe))) return false;
  for (const name of options.dep.binaries) {
    if (!(await pathExists(join(binDir, name)))) return false;
  }
  if (!options.dep.versionAwareReuse) return true;
  const have = await probeVersion(probe);
  if (!have) return false;
  return (
    have === options.expectedVersion ||
    have.startsWith(`${options.expectedVersion}.`) ||
    options.expectedVersion.startsWith(have)
  );
}

async function pointCurrent(options: {
  dependencyId: string;
  versionRoot: string;
  home: string;
}): Promise<void> {
  const current = forgeRuntimeDepCurrent(options.dependencyId, options.home);
  await mkdir(dirname(current), { recursive: true });
  const tmp = `${current}.tmp-${process.pid}`;
  await rm(tmp, { force: true });
  await symlink(options.versionRoot, tmp);
  await rename(tmp, current);
}

function binariesMap(
  dep: ProjectInfraDependency,
  binDir: string
): Record<string, string> {
  const binaries: Record<string, string> = {};
  for (const name of dep.binaries) {
    binaries[name] = join(binDir, name);
  }
  return binaries;
}

export async function installProjectInfraDependency(
  dependencyId: string,
  options: InstallProjectInfraDeps & { version?: string } = {}
): Promise<InstallProjectInfraResult> {
  const aliasHint = dependencyIdAliasHint(dependencyId);
  if (aliasHint) {
    throw new Error(aliasHint);
  }
  const dep = getProjectInfraDependency(dependencyId);
  if (!dep) {
    throw new Error(
      `Unknown dependencyId \`${dependencyId}\`. Known: ${listProjectInfraDependencyIds().join(", ") || "(none)"}.`
    );
  }
  const home = options.home ?? homedir();
  const plat = options.platform ?? osPlatform();
  const arch = options.arch ?? currentHostArch();

  const archive = dep.resolveArchive({
    platform: plat,
    arch,
    version: options.version
  });
  if (!archive) {
    throw new Error(
      `No tarball installer for ${dep.label} on ${plat}/${arch}. ` +
        `Pass a concrete version (e.g. version=20) or install manually under ~/.forge/runtime/${dep.id}/.`
    );
  }

  const versionRoot = forgeRuntimeDepVersion({
    dependencyId: dep.id,
    version: archive.version,
    home
  });
  const binDir = join(versionRoot, dep.binRelative ?? "bin");

  if (await canReuse({ dep, versionRoot, expectedVersion: archive.version })) {
    await pointCurrent({ dependencyId: dep.id, versionRoot, home });
    return {
      dependencyId: dep.id,
      version: archive.version,
      reused: true,
      binDir,
      installRoot: versionRoot,
      binaries: binariesMap(dep, binDir)
    };
  }

  await downloadAndInstallVersion({
    dep,
    archive,
    versionRoot,
    home,
    fetchImpl: options.fetchImpl ?? fetch
  });
  await pointCurrent({ dependencyId: dep.id, versionRoot, home });

  const ensuredBin = await ensureBinDir({ dep, root: versionRoot });
  const probePath = join(ensuredBin, dep.probeBinary);
  if (!(await pathExists(probePath))) {
    throw new Error(
      `Installed ${dep.label} but probe binary \`${dep.probeBinary}\` is missing under ${ensuredBin}.`
    );
  }

  return {
    dependencyId: dep.id,
    version: archive.version,
    reused: false,
    binDir: ensuredBin,
    installRoot: versionRoot,
    binaries: binariesMap(dep, ensuredBin)
  };
}

async function downloadAndInstallVersion(options: {
  dep: ProjectInfraDependency;
  archive: { url: string; version: string; fileName: string };
  versionRoot: string;
  home: string;
  fetchImpl: typeof fetch;
}): Promise<void> {
  const { dep, archive, versionRoot, home, fetchImpl } = options;
  const downloads = forgeRuntimeDownloads(home);
  const extractRoot = join(
    forgeRuntimeExtract(home),
    `${dep.id}-${archive.version}-${process.pid}`
  );
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
  const payload = await resolveExtractPayload(extractRoot);

  await rm(versionRoot, { recursive: true, force: true });
  await mkdir(dirname(versionRoot), { recursive: true });
  try {
    await rename(payload, versionRoot);
  } catch {
    const { cp } = await import("node:fs/promises");
    await cp(payload, versionRoot, { recursive: true });
  }
  await rm(extractRoot, { recursive: true, force: true });
}

export async function resolveRuntimeBinary(
  name: string,
  home = homedir()
): Promise<string | null> {
  const { forgeRuntimeBinDirs } = await import("./paths.js");
  for (const dir of forgeRuntimeBinDirs(home)) {
    const candidate = join(dir, name);
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

export async function readCurrentInstallRoot(
  dependencyId: string,
  home = homedir()
): Promise<string | null> {
  const current = forgeRuntimeDepCurrent(dependencyId, home);
  try {
    const target = await readlink(current);
    return target.startsWith("/") ? target : join(dirname(current), target);
  } catch {
    if (await pathExists(current)) return current;
    return null;
  }
}
