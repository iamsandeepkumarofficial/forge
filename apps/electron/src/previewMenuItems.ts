const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_DEFAULT = 100;

export const PREVIEW_MENU_ACTIONS = [
  "screenshot",
  "captureArea",
  "hardReload",
  "copyUrl",
  "zoomIn",
  "zoomOut",
  "zoomReset",
  "clearHistory",
  "clearCookies",
  "clearCache"
] as const;

export type PreviewMenuAction = (typeof PREVIEW_MENU_ACTIONS)[number];

export type PreviewMenuItem =
  | { type: "separator" }
  | {
      type: "action";
      action: PreviewMenuAction;
      label: string;
      enabled?: boolean;
    };

export type OverflowMenuArg = {
  zoom: number;
  x?: number;
  y?: number;
};

export function parseOverflowMenuArg(arg: unknown): OverflowMenuArg {
  if (!arg || typeof arg !== "object") return { zoom: ZOOM_DEFAULT };
  const rec = arg as Record<string, unknown>;
  const zoom = typeof rec.zoom === "number" ? rec.zoom : ZOOM_DEFAULT;
  const x = typeof rec.x === "number" ? Math.round(rec.x) : undefined;
  const y = typeof rec.y === "number" ? Math.round(rec.y) : undefined;
  return { zoom, x, y };
}

export function previewOverflowItems(zoom: number): PreviewMenuItem[] {
  return [
    { type: "action", action: "screenshot", label: "Take Screenshot" },
    { type: "action", action: "captureArea", label: "Capture Area Screenshot" },
    { type: "separator" },
    { type: "action", action: "hardReload", label: "Hard Reload" },
    { type: "action", action: "copyUrl", label: "Copy Current URL" },
    { type: "separator" },
    {
      type: "action",
      action: "zoomOut",
      label: "Zoom Out",
      enabled: zoom > ZOOM_MIN
    },
    {
      type: "action",
      action: "zoomReset",
      label: `Actual Size (${zoom}%)`,
      enabled: zoom !== ZOOM_DEFAULT
    },
    {
      type: "action",
      action: "zoomIn",
      label: "Zoom In",
      enabled: zoom < ZOOM_MAX
    },
    { type: "separator" },
    { type: "action", action: "clearHistory", label: "Clear Browsing History" },
    { type: "action", action: "clearCookies", label: "Clear Cookies" },
    { type: "action", action: "clearCache", label: "Clear Cache" }
  ];
}
