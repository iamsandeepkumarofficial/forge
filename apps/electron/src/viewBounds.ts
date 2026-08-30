export type ViewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function normalizeViewBounds(rect: ViewBounds): ViewBounds {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height))
  };
}

export function isUsableBounds(rect: ViewBounds): boolean {
  return rect.width > 0 && rect.height > 0;
}

export function parseCaptureRect(arg: unknown): ViewBounds | undefined {
  if (!arg || typeof arg !== "object") return undefined;
  const rec = arg as Record<string, unknown>;
  const x = Number(rec.x);
  const y = Number(rec.y);
  const width = Number(rec.width ?? rec.w);
  const height = Number(rec.height ?? rec.h);
  if (![x, y, width, height].every(Number.isFinite)) return undefined;
  if (width <= 0 || height <= 0) return undefined;
  return normalizeViewBounds({ x, y, width, height });
}

export function sameLoadedUrl(current: string, next: string): boolean {
  if (!current || current === "about:blank") return false;
  try {
    const a = new URL(current);
    const b = new URL(next);
    return a.href === b.href;
  } catch {
    return current === next;
  }
}
