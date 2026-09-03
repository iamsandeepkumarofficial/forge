import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defaultConfig } from "./env.js";
import type { ForgeConfig } from "./types.js";

export function defaultHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.HOME || env.USERPROFILE || ".";
}

export function forgeConfigPath(home: string = defaultHome()): string {
  return join(home, ".forge", "config.json");
}

export function readConfig(home: string = defaultHome()): ForgeConfig {
  const path = forgeConfigPath(home);
  if (!existsSync(path)) return defaultConfig();
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as ForgeConfig;
}

export function writeConfig(options: { config: ForgeConfig; home?: string }): void {
  const path = forgeConfigPath(options.home ?? defaultHome());
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(options.config, null, 2)}\n`);
}

export function stopComposeOnQuit(config: ForgeConfig): boolean {
  return config.desktop?.stopComposeOnQuit ?? true;
}
