import type { RefObject } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  pushPreviewHistory,
  samePreviewUrl,
  stripCacheBust,
  type PreviewPick
} from "./preview-nav.js";
import { captureInspectFrameShot } from "./preview-overflow.js";
import {
  capturePickShot,
  pickShotRect,
  previewPickFields
} from "./preview-pick.js";

export function handlePreviewInspectMessage(options: {
  e: MessageEvent;
  origin: string;
  commenting: boolean;
  addressRef: RefObject<string>;
  historyRef: RefObject<string[]>;
  histIndexRef: RefObject<number>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  setHistory: Dispatch<SetStateAction<string[]>>;
  setHistIndex: Dispatch<SetStateAction<number>>;
  setAddress: Dispatch<SetStateAction<string>>;
  setPick: Dispatch<SetStateAction<PreviewPick | null>>;
}): void {
  if (options.e.origin !== options.origin) return;
  const data = options.e.data as {
    type?: string;
    url?: string;
    rect?: unknown;
    viewport?: { w: number; h: number };
  } & Partial<PreviewPick>;
  if (data?.type === "forge-inspect-nav" && typeof data.url === "string") {
    const next = stripCacheBust(data.url);
    if (samePreviewUrl(options.addressRef.current, next)) return;
    const moved = pushPreviewHistory(options.historyRef.current, {
      index: options.histIndexRef.current,
      next
    });
    options.setHistory(moved.stack);
    options.setHistIndex(moved.index);
    options.setAddress(next);
    return;
  }
  if (!options.commenting || data?.type !== "forge-inspect-pick") return;
  if (typeof data.url !== "string" || typeof data.tag !== "string") return;
  const next = previewPickFields({
    url: data.url,
    tag: data.tag,
    selector: typeof data.selector === "string" ? data.selector : "",
    text: typeof data.text === "string" ? data.text : "",
    ariaLabel: typeof data.ariaLabel === "string" ? data.ariaLabel : "",
    href: typeof data.href === "string" ? data.href : "",
    nearby: typeof data.nearby === "string" ? data.nearby : "",
    rect: data.rect,
    viewport: data.viewport
  });
  options.setPick(next);
  const rect = pickShotRect({ rect: data.rect, viewport: data.viewport });
  const iframe = options.iframeRef.current;
  if (!iframe || !rect) return;
  void capturePickShot({
    rect,
    capture: (area) =>
      captureInspectFrameShot({ iframe, origin: options.origin, rect: area })
  }).then((shot) => {
    if (shot) options.setPick((cur) => (cur ? { ...cur, shot } : cur));
  });
}
