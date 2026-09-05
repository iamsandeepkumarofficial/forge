import { useState } from "react";
import type { RefObject } from "react";
import type { ForgeDesktopPreview } from "../../lib/desktop-preview.js";
import {
  cacheBustUrl,
  captureInspectFrameShot,
  capturePreviewShot,
  copyPngDataUrl,
  mapCropToPage,
  shotRectToBounds,
  type ShotRect
} from "./preview-overflow.js";

const PCT_100 = 100;
const SHOT_FALLBACK_W = 1200;
const SHOT_FALLBACK_H = 800;
const NOTICE_MS = 4000;

export function usePreviewScreenshot(options: {
  iframeBoxRef: RefObject<HTMLDivElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  previewApi: Pick<ForgeDesktopPreview, "capturePage"> | null;
  zoom: number;
  committedUrl: string;
  pageUrl: string;
}) {
  const { iframeBoxRef, iframeRef, previewApi, zoom, committedUrl, pageUrl } =
    options;
  const [chromeNotice, setChromeNotice] = useState("");

  const takeShot = async (rect?: ShotRect) => {
    const box = iframeBoxRef.current;
    const scale = zoom / PCT_100;
    const width = Math.round((box?.clientWidth ?? SHOT_FALLBACK_W) / scale);
    const height = Math.round((box?.clientHeight ?? SHOT_FALLBACK_H) / scale);
    const mapped = rect ? mapCropToPage(rect, zoom) : undefined;
    try {
      let dataUrl: string;
      if (previewApi) {
        dataUrl = await previewApi.capturePage(
          mapped ? shotRectToBounds(mapped) : undefined
        );
        await copyPngDataUrl(dataUrl);
        setChromeNotice("Screenshot copied");
        window.setTimeout(() => setChromeNotice(""), NOTICE_MS);
        return;
      }
      const live = iframeRef.current;
      if (live?.contentWindow) {
        dataUrl = await captureInspectFrameShot({
          iframe: live,
          origin: new URL(committedUrl || pageUrl).origin,
          rect: mapped
        });
      } else {
        dataUrl = await capturePreviewShot({
          pageUrl: committedUrl || pageUrl,
          width,
          height,
          rect: mapped
        });
      }
      await copyPngDataUrl(dataUrl);
      setChromeNotice("Screenshot copied");
      window.setTimeout(() => setChromeNotice(""), NOTICE_MS);
    } catch {
      setChromeNotice(
        "Couldn't capture this page. Open it in a new tab to screenshot."
      );
      window.setTimeout(() => setChromeNotice(""), NOTICE_MS);
    }
  };

  return { chromeNotice, takeShot };
}

export function previewLoadedUrl(
  committedUrl: string,
  cacheBust: number
): string {
  return cacheBust > 0 ? cacheBustUrl(committedUrl, cacheBust) : committedUrl;
}
