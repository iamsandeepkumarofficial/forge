import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const MIN_BINARY_BYTES = 1_000_000;

export function platformElectronPath() {
  if (process.platform === "darwin") {
    return "Electron.app/Contents/MacOS/Electron";
  }
  if (process.platform === "win32") {
    return "electron.exe";
  }
  return "electron";
}

export function electronPkgDir() {
  const require = createRequire(import.meta.url);
  return dirname(require.resolve("electron/package.json"));
}

export function isElectronBundleComplete(pkgDir = electronPkgDir()) {
  const relative = platformElectronPath();
  const binary = join(pkgDir, "dist", relative);
  if (!existsSync(binary)) return false;
  if (process.platform === "darwin") {
    return existsSync(
      join(
        pkgDir,
        "dist/Electron.app/Contents/Frameworks/Electron Framework.framework/Electron Framework"
      )
    );
  }
  try {
    return statSync(binary).size >= MIN_BINARY_BYTES;
  } catch {
    return false;
  }
}

export function resolveElectronBinary() {
  const pkgDir = electronPkgDir();
  const relative = platformElectronPath();
  const binary = join(pkgDir, "dist", relative);
  if (!isElectronBundleComplete(pkgDir)) {
    throw new Error(
      `Electron install is incomplete (${binary}). Run pnpm --filter @forge/electron run postinstall.`
    );
  }
  writePathTxt(pkgDir, relative);
  return binary;
}

export function reinstallElectron() {
  const pkgDir = electronPkgDir();
  rmSync(join(pkgDir, "dist"), { recursive: true, force: true });
  rmSync(join(pkgDir, "path.txt"), { force: true });
  runElectronInstallJs(pkgDir);
  if (isElectronBundleComplete(pkgDir)) {
    return resolveElectronBinary();
  }
  process.stderr.write(
    "[forge-electron] extract-zip left a stub bundle; unzipping the cached zip…\n"
  );
  unzipCachedArtifact(pkgDir);
  return resolveElectronBinary();
}

export function ensureElectron() {
  if (isElectronBundleComplete()) {
    return resolveElectronBinary();
  }
  process.stderr.write(
    "[forge-electron] Electron Framework missing; re-downloading Chromium…\n"
  );
  return reinstallElectron();
}

function writePathTxt(pkgDir, relative) {
  writeFileSync(join(pkgDir, "path.txt"), relative);
}

function runElectronInstallJs(pkgDir) {
  const install = join(pkgDir, "install.js");
  const result = spawnSync(process.execPath, [install], {
    cwd: pkgDir,
    stdio: "inherit",
    env: { ...process.env, force_no_cache: "true" }
  });
  if (result.status !== 0 && result.status !== null) {
    process.stderr.write("[forge-electron] electron/install.js failed; will try unzip fallback\n");
  }
}

function unzipCachedArtifact(pkgDir) {
  const zip = findCachedElectronZip(pkgDir);
  if (!zip) {
    throw new Error(
      "Could not find a cached Electron zip. Delete node_modules/electron and run pnpm install."
    );
  }
  rmSync(join(pkgDir, "dist"), { recursive: true, force: true });
  const dest = join(pkgDir, "dist");
  const unzipped = spawnSync("unzip", ["-q", "-o", zip, "-d", dest], {
    stdio: "inherit"
  });
  if (unzipped.status !== 0) {
    throw new Error(`unzip failed for ${zip}`);
  }
}

function findCachedElectronZip(pkgDir) {
  const require = createRequire(import.meta.url);
  const { version } = require(join(pkgDir, "package.json"));
  const roots = [
    process.env.electron_config_cache,
    join(homedir(), "Library/Caches/electron"),
    join(homedir(), ".cache/electron"),
    join(homedir(), "AppData/Local/electron/Cache")
  ].filter(Boolean);
  const needle = `electron-v${version}-`;
  for (const root of roots) {
    const found = findZipUnder(root, needle);
    if (found) return found;
  }
  return null;
}

function findZipUnder(root, needle) {
  if (!existsSync(root)) return null;
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) {
      if (name.startsWith(needle) && name.endsWith(".zip")) return dir;
      continue;
    }
    for (const file of readdirSync(dir)) {
      if (file.startsWith(needle) && file.endsWith(".zip")) {
        return join(dir, file);
      }
    }
  }
  return null;
}
