import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type HostSandboxWrapResult = {
  argv: string[];
  enabled: boolean;
  platform: NodeJS.Platform;
  reason?: string;
};

const N_2 = 2;

export function hostSandboxEnabled(): boolean {
  return process.env.FORGE_HOST_SANDBOX?.trim() !== "0";
}

function resourcesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../resources/os-sandbox");
}

export function seatbeltProfileTemplatePath(): string {
  return path.join(resourcesDir(), "seatbelt-default.sb");
}

export function defaultWritableRoots(
  sessionRoot: string,
  extraRoots: string[] = []
): string[] {
  const home = os.homedir();
  const roots = [
    sessionRoot,
    path.join(sessionRoot, ".forge-runtime"),
    ...extraRoots,
    path.join(home, ".npm"),
    path.join(home, ".cache"),
    path.join(home, "Library", "Caches"),
    path.join(home, ".local", "share", "pnpm")
  ];
  return [...new Set(roots.map((r) => path.resolve(r)))];
}

export async function materializeSeatbeltProfile(options: {
  writableRoots: string[];
  profilePath: string;
}): Promise<string> {
  const template = await fs.readFile(seatbeltProfileTemplatePath(), "utf8");
  const home = os.homedir();
  const writableExpr = options.writableRoots
    .map((r) => `(subpath "${r}")`)
    .join(" ");
  const body = template
    .replace(
      '(allow file-write* (subpath "{{WRITABLE_ROOTS}}"))',
      `(allow file-write* ${writableExpr})`
    )
    .replaceAll("{{HOME}}", home);
  await fs.mkdir(path.dirname(options.profilePath), { recursive: true });
  await fs.writeFile(options.profilePath, body, "utf8");
  return options.profilePath;
}

export function buildBwrapArgv(options: {
  argv: string[];
  writableRoots: string[];
  cwd: string;
  readableRoots?: string[];
}): string[] {
  const prefix: string[] = [
    "bwrap",
    "--die-with-parent",
    "--dev",
    "/dev",
    "--proc",
    "/proc",
    "--tmpfs",
    "/tmp"
  ];
  for (const dir of [
    "/usr",
    "/bin",
    "/sbin",
    "/lib",
    "/lib64",
    "/etc",
    "/opt"
  ]) {
    prefix.push("--ro-bind-try", dir, dir);
  }
  const home = os.homedir();
  for (const dir of [
    path.join(home, ".forge", "runtime"),
    path.join(home, ".npm"),
    path.join(home, ".cache"),
    path.join(home, ".local", "share", "pnpm")
  ]) {
    prefix.push("--ro-bind-try", dir, dir);
  }
  const readable = [
    ...new Set(
      [...(options.readableRoots ?? []), ...options.writableRoots].map((r) =>
        path.resolve(r)
      )
    )
  ];
  for (const root of readable) {
    if (options.writableRoots.map((r) => path.resolve(r)).includes(root)) {
      continue;
    }
    prefix.push("--ro-bind-try", root, root);
  }
  for (const root of options.writableRoots) {
    prefix.push("--bind-try", root, root);
  }
  prefix.push("--chdir", options.cwd);
  return [...prefix, ...options.argv];
}

export function buildSeatbeltArgv(options: {
  argv: string[];
  profilePath: string;
}): string[] {
  return ["sandbox-exec", "-f", options.profilePath, ...options.argv];
}

export async function wrapHostCommand(options: {
  argv: string[];
  sessionRoot: string;
  cwd: string;
  platform?: NodeJS.Platform;
  extraWritableRoots?: string[];
}): Promise<HostSandboxWrapResult> {
  const platform = options.platform ?? process.platform;
  if (!hostSandboxEnabled()) {
    return {
      argv: options.argv,
      enabled: false,
      platform,
      reason: "FORGE_HOST_SANDBOX=0"
    };
  }
  if (options.argv.length === 0) {
    return {
      argv: options.argv,
      enabled: false,
      platform,
      reason: "empty argv"
    };
  }

  const writableRoots = defaultWritableRoots(
    options.sessionRoot,
    options.extraWritableRoots ?? []
  );

  if (platform === "darwin") {
    const profilePath = path.join(
      options.sessionRoot,
      ".forge-runtime",
      "seatbelt.sb"
    );
    await materializeSeatbeltProfile({ writableRoots, profilePath });
    return {
      argv: buildSeatbeltArgv({
        argv: options.argv,
        profilePath
      }),
      enabled: true,
      platform
    };
  }

  if (platform === "linux") {
    return {
      argv: buildBwrapArgv({
        argv: options.argv,
        writableRoots,
        cwd: options.cwd
      }),
      enabled: true,
      platform
    };
  }

  if (platform === "win32") {
    return {
      argv: options.argv,
      enabled: false,
      platform,
      reason:
        "Windows host sandbox requires WSL2+bwrap (not auto-wrapped in this phase)"
    };
  }

  return {
    argv: options.argv,
    enabled: false,
    platform,
    reason: `unsupported platform ${platform}`
  };
}

export async function commandOnPath(command: string): Promise<boolean> {
  if (command.includes(path.sep) || command.startsWith(".")) {
    try {
      await fs.access(command);
      return true;
    } catch {
      return false;
    }
  }
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    try {
      await fs.access(path.join(dir, command));
      return true;
    } catch {
      void 0;
    }
  }
  return false;
}

export async function resolveWrappedArgv(options: {
  argv: string[];
  sessionRoot: string;
  cwd: string;
  platform?: NodeJS.Platform;
  extraWritableRoots?: string[];
}): Promise<string[]> {
  const wrapped = await wrapHostCommand(options);
  if (!wrapped.enabled) return wrapped.argv;
  const bin = wrapped.argv[0];
  if (!bin || (await commandOnPath(bin))) return wrapped.argv;
  return options.argv;
}

export function assertProfileDeniesSsh(profileBody: string): boolean {
  return (
    profileBody.includes(".ssh") &&
    profileBody
      .split("\n")
      .filter((l) => l.includes("deny") && l.includes(".ssh")).length >= N_2
  );
}

export function assertProfileDeniesForgeProjects(profileBody: string): boolean {
  return (
    profileBody.includes(".forge/projects") &&
    profileBody
      .split("\n")
      .some((l) => l.includes("deny") && l.includes(".forge/projects"))
  );
}
