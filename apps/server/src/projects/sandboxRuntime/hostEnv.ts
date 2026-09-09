import fs from "node:fs/promises";
import path from "node:path";

const ENV_ALLOWLIST = new Set([
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TMPDIR",
  "TEMP",
  "TMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "COLORTERM",
  "NODE_OPTIONS",
  "npm_config_cache",
  "PNPM_HOME",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy"
]);

export function scrubHostEnv(
  extra?: Record<string, string>
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const key of ENV_ALLOWLIST) {
    const v = process.env[key];
    if (v !== undefined) out[key] = v;
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      out[k] = v;
    }
  }
  if (!out.TERM) out.TERM = "xterm-256color";
  return out;
}

export function hostSessionTempDir(sessionRoot: string): string {
  return path.join(sessionRoot, ".forge-runtime", "tmp");
}

export async function hostProcessEnv(
  sessionRoot: string,
  extra?: Record<string, string>
): Promise<NodeJS.ProcessEnv> {
  const tmp = hostSessionTempDir(sessionRoot);
  await fs.mkdir(tmp, { recursive: true });
  return scrubHostEnv({
    ...extra,
    TMPDIR: tmp,
    TEMP: tmp,
    TMP: tmp
  });
}
