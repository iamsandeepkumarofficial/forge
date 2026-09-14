export function isHostDesktopMode(
  _env: NodeJS.ProcessEnv = process.env
): boolean {
  return true;
}

export const NATIVE_PG_PORT = 5433;
export const NATIVE_TEMPORAL_PORT = 7233;
export const NATIVE_TEMPORAL_UI_PORT = 8233;

export const NATIVE_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5433/forge";

export function forgeHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.HOME || env.USERPROFILE || ".";
}
