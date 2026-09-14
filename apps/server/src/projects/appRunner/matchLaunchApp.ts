import type { ForgeApp } from "./types.js";

export function matchLaunchApp(
  apps: ForgeApp[],
  requested: string
): ForgeApp | undefined {
  const q = requested.trim();
  if (!q) return undefined;
  const exact = apps.find((a) => a.name === q);
  if (exact) return exact;
  const prefixed = apps.filter(
    (a) => a.name === `${q}/${q}` || a.name.startsWith(`${q}/`)
  );
  if (prefixed.length === 1) return prefixed[0];
  if (prefixed.length > 1) {
    return (
      prefixed.find((a) => a.name === `${q}/${q}` || a.repo === q) ??
      prefixed[0]
    );
  }
  const byLocalOrRepo = apps.filter(
    (a) =>
      a.repo === q ||
      a.name.endsWith(`/${q}`) ||
      (a.repo != null && a.name === `${a.repo}/${q}`)
  );
  if (byLocalOrRepo.length === 1) return byLocalOrRepo[0];
  return undefined;
}
