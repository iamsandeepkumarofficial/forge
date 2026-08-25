const N_5 = 5;
const N_8000 = 8000;

export function webToolsEnabled(): boolean {
  const raw = process.env.WEB_TOOLS_ENABLED?.trim().toLowerCase();
  if (!raw) return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
export function webSearchMinWarm(): number {
  const n = Number(process.env.WEB_SEARCH_MIN_WARM ?? "1");
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
}
export function webSearchMaxWorkers(): number {
  const n = Number(process.env.WEB_SEARCH_MAX_WORKERS ?? "5");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : N_5;
}
export function webSearchTargetLatencyMs(): number {
  const n = Number(process.env.WEB_SEARCH_TARGET_LATENCY_MS ?? "8000");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : N_8000;
}
