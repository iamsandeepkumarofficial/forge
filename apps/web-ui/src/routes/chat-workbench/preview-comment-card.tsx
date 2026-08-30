import { useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { PreviewAnchor, PreviewPick } from "./preview-nav.js";

export const PREVIEW_FREEZE_FALLBACK =
  "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

const WIDGET_WIDTH = 360;
const WIDGET_GAP = 12;
const WIDGET_EST_HEIGHT = 320;
const TEXT_PREVIEW = 80;
const NEARBY_PREVIEW = 160;
const PCT = 100;

export type WidgetPane = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function scaleAnchor(options: {
  pane: Pick<WidgetPane, "width" | "height">;
  anchor: PreviewAnchor;
  viewport?: { w: number; h: number };
}): PreviewAnchor {
  const sx = options.viewport?.w ? options.pane.width / options.viewport.w : 1;
  const sy = options.viewport?.h ? options.pane.height / options.viewport.h : 1;
  return {
    x: options.anchor.x * sx,
    y: options.anchor.y * sy,
    w: options.anchor.w * sx,
    h: options.anchor.h * sy
  };
}

export function commentWidgetPosition(options: {
  pane: WidgetPane;
  anchor?: PreviewAnchor;
  viewport?: { w: number; h: number };
}): { left: number; top: number } {
  const { pane, anchor, viewport } = options;
  const minLeft = pane.left + WIDGET_GAP;
  const minTop = pane.top + WIDGET_GAP;
  const maxLeft = pane.left + pane.width - WIDGET_WIDTH - WIDGET_GAP;
  const maxTop = pane.top + pane.height - WIDGET_EST_HEIGHT - WIDGET_GAP;
  if (!anchor) {
    return { left: Math.round(minLeft), top: Math.round(minTop) };
  }
  const box = scaleAnchor({ pane, anchor, viewport });
  const right = pane.left + box.x + box.w + WIDGET_GAP;
  const leftSide = pane.left + box.x - WIDGET_WIDTH - WIDGET_GAP;
  const paneRight = pane.left + pane.width - WIDGET_GAP;
  const fitsRight = right + WIDGET_WIDTH <= paneRight;
  const fitsLeft = leftSide >= minLeft;
  const alignedTop = pane.top + box.y;
  const below = pane.top + box.y + box.h + WIDGET_GAP;
  let left = fitsRight ? right : fitsLeft ? leftSide : pane.left + box.x;
  let top = fitsRight || fitsLeft ? alignedTop : below;
  left = Math.max(minLeft, Math.min(maxLeft, left));
  top = Math.max(minTop, Math.min(maxTop, top));
  return { left: Math.round(left), top: Math.round(top) };
}

export function PreviewFreezeLayer(options: {
  src: string;
  anchor?: PreviewAnchor;
  viewport?: { w: number; h: number };
}) {
  const { src, anchor, viewport } = options;
  return (
    <>
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-fill"
      />
      {anchor ? (
        <div
          className="pointer-events-none absolute border-2 border-sky-500 bg-sky-500/10"
          style={anchorOverlayStyle(anchor, viewport)}
        />
      ) : null}
    </>
  );
}

export function PreviewCommentCard(options: {
  pick: PreviewPick;
  draft: string;
  onDraft: (v: string) => void;
  onCancel: () => void;
  onSend: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const { pick, draft, onDraft, onCancel, onSend, anchorRef } = options;
  const pos = useWidgetPosition(anchorRef, pick);
  const card = (
    <div
      role="dialog"
      aria-label="Comment on this element"
      className="fixed z-50 flex max-h-[min(36rem,calc(100vh-1.5rem))] w-[22.5rem] flex-col overflow-y-auto rounded-xl border bg-background p-3 shadow-xl"
      style={{ left: pos.left, top: pos.top }}
    >
      <p className="text-xs font-medium">Comment on this element</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{pick.tag}</span>
        {pick.selector ? ` · ${pick.selector}` : ""}
        {pick.text ? ` · “${pick.text.slice(0, TEXT_PREVIEW)}”` : ""}
      </p>
      {pick.nearby ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Nearby: {pick.nearby.slice(0, NEARBY_PREVIEW)}
        </p>
      ) : null}
      {pick.shot ? (
        <img
          src={pick.shot}
          alt="Selected preview section"
          className="mt-2 max-h-40 rounded-md border object-contain"
        />
      ) : null}
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        placeholder="What should change about this element?"
        className="mt-2 min-h-28 w-full resize-y rounded-md border bg-background px-2.5 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={!draft.trim()}
          className="rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background disabled:opacity-40"
        >
          Send to chat
        </button>
      </div>
    </div>
  );
  return createPortal(card, document.body);
}

function anchorOverlayStyle(
  anchor: PreviewAnchor,
  viewport?: { w: number; h: number }
): { left: string; top: string; width: string; height: string } {
  const vw = viewport?.w || 1;
  const vh = viewport?.h || 1;
  return {
    left: `${(anchor.x / vw) * PCT}%`,
    top: `${(anchor.y / vh) * PCT}%`,
    width: `${(anchor.w / vw) * PCT}%`,
    height: `${(anchor.h / vh) * PCT}%`
  };
}

function useWidgetPosition(
  anchorRef: RefObject<HTMLElement | null> | undefined,
  pick: PreviewPick
): { left: number; top: number } {
  const [pos, setPos] = useState({ left: WIDGET_GAP, top: WIDGET_GAP });
  useLayoutEffect(() => {
    const el = anchorRef?.current;
    if (!el) return undefined;
    const publish = () => {
      const pane = el.getBoundingClientRect();
      setPos(
        commentWidgetPosition({
          pane: {
            left: pane.left,
            top: pane.top,
            width: pane.width,
            height: pane.height
          },
          anchor: pick.anchor,
          viewport: pick.viewport
        })
      );
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener("resize", publish);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, [anchorRef, pick.anchor, pick.viewport]);
  return pos;
}
