import { spawn, spawnSync, type ChildProcess } from "node:child_process";

export type SpawnLoggedOptions = {
  cmd: string;
  args: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  label: string;
};

export function spawnLogged(options: SpawnLoggedOptions): ChildProcess {
  const child = spawn(options.cmd, [...options.args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
    shell: process.platform === "win32"
  });
  pipeLabeled(child, options.label);
  return child;
}

export function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      return;
    }
  }
}

function pipeLabeled(child: ChildProcess, label: string): void {
  const prefix = `[${label}] `;
  child.stdout?.on("data", (buf: Buffer) => {
    process.stderr.write(`${prefix}${buf.toString()}`);
  });
  child.stderr?.on("data", (buf: Buffer) => {
    process.stderr.write(`${prefix}${buf.toString()}`);
  });
}
