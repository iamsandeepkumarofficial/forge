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
