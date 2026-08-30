import type { PreviewPickResult } from "../../lib/desktop-preview.js";
import type { PreviewPick } from "./preview-nav.js";
import {
  padShotRect,
  type ShotRect
} from "./preview-overflow.js";

export function previewPickFields(data: {
  url: string;
  tag: string;
  selector?: string;
  text?: string;
  ariaLabel?: string;
  href?: string;
  nearby?: string;
  rect?: unknown;
  viewport?: { w: number; h: number };
}): PreviewPick {
  return {
    url: data.url,
    tag: data.tag,
    selector: data.selector ?? "",
    text: data.text ?? "",
    ariaLabel: data.ariaLabel || undefined,
    href: data.href || undefined,
    nearby: data.nearby || undefined,
    anchor: isShotRect(data.rect)
      ? { x: data.rect.x, y: data.rect.y, w: data.rect.w, h: data.rect.h }
      : undefined,
    viewport: data.viewport
  };
}

export function isShotRect(value: unknown): value is ShotRect {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return [rec.x, rec.y, rec.w, rec.h].every(
    (n) => typeof n === "number" && Number.isFinite(n)
  );
}

export function pickShotRect(data: {
  rect?: unknown;
  viewport?: { w: number; h: number };
}): ShotRect | undefined {
  if (!isShotRect(data.rect)) return undefined;
  const view = data.viewport ?? {
    w: data.rect.x + data.rect.w + 1,
    h: data.rect.y + data.rect.h + 1
  };
  return padShotRect(data.rect, view);
}

export async function capturePickShot(options: {
  rect?: ShotRect;
  capture: (rect: ShotRect) => Promise<string>;
}): Promise<string | undefined> {
  if (!options.rect) return undefined;
  return options.capture(options.rect);
}

export function pickFromElectron(result: PreviewPickResult): {
  pick: PreviewPick;
  rect?: ShotRect;
} {
  return {
    pick: previewPickFields(result),
    rect: pickShotRect({
      rect: result.rect,
      viewport: result.viewport
    })
  };
}
