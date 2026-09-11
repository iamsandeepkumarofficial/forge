import { matchLaunchApp, readForgeConfig } from "./appRunner.js";

export async function resolveAppLogStreamName(
  sessionId: string,
  requested: string
): Promise<string> {
  const name = requested.trim();
  if (!name) return name;
  try {
    const loaded = await readForgeConfig(sessionId);
    return matchLaunchApp(loaded.config.apps, name)?.name ?? name;
  } catch {
    return name;
  }
}
