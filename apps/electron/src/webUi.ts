import type { ChildProcess } from "node:child_process";
import { isHttpOk } from "./httpWait.js";
import { spawnLogged } from "./processTree.js";
import { WEB_UI_URL } from "./types.js";

export type EnsureWebUiOptions = {
  root: string;
  check?: () => Promise<boolean>;
  spawn?: (root: string) => ChildProcess;
};

export async function ensureWebUi(
  options: EnsureWebUiOptions
): Promise<ChildProcess | null> {
  const up = options.check
    ? await options.check()
    : await isHttpOk(WEB_UI_URL);
  if (up) return null;
  const spawnFn = options.spawn ?? spawnWebUi;
  return spawnFn(options.root);
}

export function spawnWebUi(root: string): ChildProcess {
  return spawnLogged({
    cmd: "pnpm",
    args: [
      "--filter",
      "@forge/web-ui",
      "exec",
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      "5173"
    ],
    cwd: root,
    label: "@forge/web-ui"
  });
}
