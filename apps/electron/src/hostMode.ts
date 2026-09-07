export const NATIVE_PG_PORT = 5433;
export const NATIVE_TEMPORAL_PORT = 7233;
export const NATIVE_TEMPORAL_UI_PORT = 8233;

export const NATIVE_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5433/forge";

export function isHostDesktopMode(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const raw = env.SANDBOX_RUNTIME?.trim().toLowerCase();
  if (raw === "docker" || raw === "kubernetes" || raw === "k8s") {
    return false;
  }
  if (raw === "host") return true;
  return env.FORGE_DESKTOP?.trim() === "1";
}

export function forgeHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.HOME || env.USERPROFILE || ".";
}
