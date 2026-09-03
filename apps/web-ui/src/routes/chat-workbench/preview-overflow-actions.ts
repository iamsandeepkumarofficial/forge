import { electronPreview } from "../../lib/desktop.js";

export type PreviewOverflowAction =
  | "screenshot"
  | "captureArea"
  | "hardReload"
  | "copyUrl"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  | "clearHistory"
  | "clearCookies"
  | "clearCache";

export type PreviewOverflowHandlers = Record<PreviewOverflowAction, () => void>;

export function overflowHandlers(options: {
  onTakeScreenshot: () => void;
  onCaptureArea: () => void;
  onHardReload: () => void;
  onCopyUrl: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClearHistory: () => void;
  onClearCookies: () => void;
  onClearCache: () => void;
}): PreviewOverflowHandlers {
  return {
    screenshot: options.onTakeScreenshot,
    captureArea: options.onCaptureArea,
    hardReload: options.onHardReload,
    copyUrl: options.onCopyUrl,
    zoomIn: options.onZoomIn,
    zoomOut: options.onZoomOut,
    zoomReset: options.onZoomReset,
    clearHistory: options.onClearHistory,
    clearCookies: options.onClearCookies,
    clearCache: options.onClearCache
  };
}

export function runPreviewOverflowAction(
  action: string | null | undefined,
  handlers: PreviewOverflowHandlers
): void {
  if (!action || !(action in handlers)) return;
  handlers[action as PreviewOverflowAction]();
}

export async function openNativePreviewMenu(options: {
  trigger: Pick<HTMLElement, "getBoundingClientRect">;
  zoom: number;
  handlers: PreviewOverflowHandlers;
}): Promise<void> {
  const { trigger, zoom, handlers } = options;
  const api = electronPreview();
  if (!api?.showOverflowMenu) return;
  const rect = trigger.getBoundingClientRect();
  const action = await api.showOverflowMenu({
    zoom,
    x: rect.left,
    y: rect.bottom
  });
  runPreviewOverflowAction(action, handlers);
}
