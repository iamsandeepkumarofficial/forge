import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { docker } from "./sessionSandbox/container.js";
import { WORKSPACE_MOUNT } from "./sessionSandbox/constants.js";

const execFileAsync = promisify(execFile);

export const DEPS_CACHE_MOUNT = "/forge-ws-cache";

const N_2 = 2;
const N_32 = 32;
const N_1024 = 1024;

export function workspaceDepsVolumeName(workspaceId: string): string {
  const cleaned = workspaceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, N_32);
  return `forge-ws-deps-${cleaned || "ws"}`;
}

export async function ensureWorkspaceDepsVolume(
  workspaceId: string,
  options?: { hostMode?: boolean }
): Promise<string> {
  if (options?.hostMode) {
    return workspaceDepsVolumeName(workspaceId);
  }
  const name = workspaceDepsVolumeName(workspaceId);
  try {
    await execFileAsync("docker", ["volume", "inspect", name]);
  } catch {
    await docker(["volume", "create", name]);
  }
  return name;
}

function cacheDir(repoName: string): string {
  return `${DEPS_CACHE_MOUNT}/${repoName}`;
}

function repoAbs(repoName: string): string {
  return repoName ? `${WORKSPACE_MOUNT}/${repoName}` : WORKSPACE_MOUNT;
}

const LOCKHASH_SCRIPT = `
primary_lock() {
  d="$1"
  if [ -f "$d/pnpm-lock.yaml" ]; then echo "$d/pnpm-lock.yaml"
  elif [ -f "$d/yarn.lock" ]; then echo "$d/yarn.lock"
  elif [ -f "$d/package-lock.json" ]; then echo "$d/package-lock.json"
  elif [ -f "$d/bun.lockb" ]; then echo "$d/bun.lockb"
  fi
}
lockhash() {
  d="$1"
  L=$(primary_lock "$d")
  cat "$d/package.json" $L 2>/dev/null | sha256sum | awk '{print $1}'
}
`;

async function isHostRuntime(sessionId?: string): Promise<boolean> {
  if (!sessionId) return false;
  const { isHostSession } = await import("./sandboxRuntime/resolve.js");
  return isHostSession(sessionId);
}

export async function restoreCachedDeps(options: {
  containerName: string;
  repoName: string;
  sessionId?: string;
}): Promise<boolean> {
  if (await isHostRuntime(options.sessionId)) return false;
  const abs = repoAbs(options.repoName);
  const cache = cacheDir(options.repoName);
  const script = `
set +e
${LOCKHASH_SCRIPT}
if [ ! -f "${abs}/package.json" ] || [ ! -d "${cache}/node_modules" ]; then
  exit 0
fi
CUR=$(lockhash "${abs}")
CACHED=""
if [ -f "${cache}/.forge-lockhash" ]; then
  CACHED=$(cat "${cache}/.forge-lockhash")
fi
# Exact match is ideal; soft-restore when cache exists so new chats are not
# left without node_modules after minor lockfile / package.json drift.
if [ -n "$CACHED" ] && [ "$CACHED" != "$CUR" ]; then
  echo "hash-mismatch cached=$CACHED current=$CUR" >&2
fi
# Revisit must not yank modules from a live Next/node process.
if [ -L "${abs}/node_modules" ]; then
  target=$(readlink "${abs}/node_modules" 2>/dev/null || true)
  case "$target" in
    "${cache}/node_modules"|"${cache}/node_modules/")
      echo already-linked
      exit 0
      ;;
  esac
fi
if [ -d "${abs}/node_modules" ] && [ ! -L "${abs}/node_modules" ]; then
  if [ -n "$CACHED" ] && [ "$CACHED" = "$CUR" ]; then
    echo already-present
    exit 0
  fi
fi
rm -rf "${abs}/node_modules"
if ln -sfn "${cache}/node_modules" "${abs}/node_modules" 2>/dev/null; then
  if [ -e "${abs}/node_modules" ] || [ -L "${abs}/node_modules" ]; then
    echo restored-link
    exit 0
  fi
fi
cp -a "${cache}/node_modules" "${abs}/node_modules" && echo restored-copy
`;
  try {
    const { stdout, stderr } = await execFileAsync(
      "docker",
      ["exec", options.containerName, "sh", "-c", script],
      { maxBuffer: N_2 * N_1024 * N_1024 }
    );
    if (stderr?.includes("hash-mismatch")) {
      console.warn(
        `[workspaceDepsCache] restore ${options.repoName}: ${stderr.trim()}`
      );
    }
    return /already-(linked|present)|restored-(link|copy)/.test(stdout);
  } catch (err) {
    console.warn(
      `[workspaceDepsCache] restore failed ${options.repoName}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return false;
  }
}

export async function captureCachedDeps(options: {
  containerName: string;
  repoName: string;
  sessionId?: string;
}): Promise<boolean> {
  if (await isHostRuntime(options.sessionId)) return false;
  const abs = repoAbs(options.repoName);
  const cache = cacheDir(options.repoName);
  const script = `
set +e
${LOCKHASH_SCRIPT}
# Resolve through symlink so we do not capture the cache into itself.
if [ -L "${abs}/node_modules" ]; then
  target=$(readlink "${abs}/node_modules" 2>/dev/null || true)
  case "$target" in
    "${cache}/node_modules"|"${cache}/node_modules/")
      lockhash "${abs}" > "${cache}/.forge-lockhash"
      echo captured-symlink
      exit 0
      ;;
  esac
  # Unexpected symlink — materialize then capture.
  rm -rf "${abs}/.forge-nm-real"
  cp -a "${abs}/node_modules" "${abs}/.forge-nm-real" 2>/dev/null || exit 0
  rm -rf "${abs}/node_modules"
  mv "${abs}/.forge-nm-real" "${abs}/node_modules"
fi
if [ ! -d "${abs}/node_modules" ]; then
  exit 0
fi
mkdir -p "${cache}"
rm -rf "${cache}/node_modules"
if mv "${abs}/node_modules" "${cache}/node_modules" 2>/dev/null; then
  :
else
  cp -a "${abs}/node_modules" "${cache}/node_modules" || exit 0
  rm -rf "${abs}/node_modules"
fi
ln -sfn "${cache}/node_modules" "${abs}/node_modules"
lockhash "${abs}" > "${cache}/.forge-lockhash"
echo captured
`;
  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["exec", options.containerName, "sh", "-c", script],
      { maxBuffer: N_2 * N_1024 * N_1024 }
    );
    return /captured/.test(stdout);
  } catch (err) {
    console.warn(
      `[workspaceDepsCache] capture failed ${options.repoName}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return false;
  }
}

export async function clearWorkspaceDepsCache(
  workspaceId: string,
  options?: { hostMode?: boolean }
): Promise<void> {
  if (options?.hostMode) return;
  const name = await ensureWorkspaceDepsVolume(workspaceId);
  try {
    await execFileAsync("docker", [
      "run",
      "--rm",
      "-v",
      `${name}:${DEPS_CACHE_MOUNT}`,
      "alpine:3.20",
      "sh",
      "-c",
      `rm -rf ${DEPS_CACHE_MOUNT}/* ${DEPS_CACHE_MOUNT}/.[!.]* ${DEPS_CACHE_MOUNT}/..?* 2>/dev/null; exit 0`
    ]);
  } catch (err) {
    console.warn(
      `[workspaceDepsCache] clear failed for ${name}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    throw err;
  }
}
