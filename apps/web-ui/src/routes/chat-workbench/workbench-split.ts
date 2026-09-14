import { SPLIT_KEY } from "./storage.js";

export const IDLE_LEFT_PCT = 50;
export const PREVIEW_LEFT_PCT = 32;
export const SPLIT_MIN = 20;
export const SPLIT_MAX = 70;
export const LEFT_MIN_PX = 280;
const N_PERCENT = 100;

export function leftPaneWidthPx(
  containerWidth: number,
  leftPct: number
): number {
  return (containerWidth * leftPct) / N_PERCENT;
}

export function shouldCollapseLeft(
  containerWidth: number,
  leftPct: number
): boolean {
  return leftPaneWidthPx(containerWidth, leftPct) < LEFT_MIN_PX;
}

export function leftPctForMinWidth(containerWidth: number): number {
  if (containerWidth <= 0) return SPLIT_MIN;
  return clampSplitPct(Math.round((LEFT_MIN_PX / containerWidth) * N_PERCENT));
}
const SPLIT_NEAR = 3;
const LEGACY_DEFAULT = 38;

export function isAdaptiveDefault(pct: number): boolean {
  return [IDLE_LEFT_PCT, PREVIEW_LEFT_PCT, LEGACY_DEFAULT].some(
    (d) => Math.abs(pct - d) <= SPLIT_NEAR
  );
}

export function storedSplitPct(): number | null {
  try {
    const v = Number(localStorage.getItem(SPLIT_KEY));
    if (Number.isFinite(v) && v >= SPLIT_MIN && v <= SPLIT_MAX) return v;
  } catch {
    void 0;
  }
  return null;
}

export function nextSplitPct(options: {
  current: number;
  hasPreview: boolean;
  userOverride: boolean;
  hasStoredSplit?: boolean;
}): number {
  if (options.userOverride) return options.current;
  if (options.hasStoredSplit) return options.current;
  if (!isAdaptiveDefault(options.current)) return options.current;
  return options.hasPreview ? PREVIEW_LEFT_PCT : IDLE_LEFT_PCT;
}

export function initialSplitPct(): number {
  return storedSplitPct() ?? IDLE_LEFT_PCT;
}

export function clampSplitPct(pct: number): number {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct));
}
