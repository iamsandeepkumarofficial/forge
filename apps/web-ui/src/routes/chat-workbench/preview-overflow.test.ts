import { describe, it, expect, vi } from "vitest";
import {
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  cacheBustUrl,
  clampZoom,
  copyPngDataUrl,
  padShotRect,
  clearSiteUrl,
  iframeZoomStyle,
  inspectShotUrl,
  mapCropToPage,
  normalizeCrop,
  screenshotFilename,
  stepZoom
} from "./preview-overflow";

describe("preview-overflow", () => {
  it("steps and clamps zoom", () => {
    expect(stepZoom(100, 1)).toBe(125);
    expect(stepZoom(100, -1)).toBe(75);
    expect(stepZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
    expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(clampZoom(12)).toBe(ZOOM_MIN);
    expect(clampZoom(999)).toBe(ZOOM_MAX);
  });

  it("scales the iframe so zoom keeps the pane filled", () => {
    expect(iframeZoomStyle(ZOOM_DEFAULT)).toEqual({
      transform: "scale(1)",
      transformOrigin: "top left",
      width: "100%",
      height: "100%"
    });
    expect(iframeZoomStyle(200).width).toBe("50%");
    expect(iframeZoomStyle(50).width).toBe("200%");
  });

  it("normalizes a drag rect and maps it through zoom", () => {
    expect(normalizeCrop({ x: 40, y: 10 }, { x: 10, y: 40 })).toEqual({
      x: 10,
      y: 10,
      w: 30,
      h: 30
    });
    expect(mapCropToPage({ x: 50, y: 20, w: 100, h: 40 }, 200)).toEqual({
      x: 25,
      y: 10,
      w: 50,
      h: 20
    });
  });

  it("builds cache-bust, clear, and inspect URLs", () => {
    expect(cacheBustUrl("http://p3001-s.preview.localhost:8081/about", 3)).toBe(
      "http://p3001-s.preview.localhost:8081/about?_forge_cb=3"
    );
    expect(clearSiteUrl("http://p3001-s.preview.localhost:8081/app")).toBe(
      "http://p3001-s.preview.localhost:8081/__forge/clear"
    );
    expect(inspectShotUrl("http://p3001-s.preview.localhost:8081/about?q=1")).toBe(
      "http://p3001-s.preview.localhost:8081/__forge/inspect?src=%2Fabout%3Fq%3D1"
    );
    expect(clearSiteUrl("not-a-url")).toBeNull();
  });

  it("pads a shot rect for nearby context", () => {
    expect(padShotRect({ x: 80, y: 80, w: 20, h: 10 }, { w: 200, h: 200 })).toEqual({
      x: 32,
      y: 32,
      w: 116,
      h: 106
    });
  });

  it("copies a png data url to the clipboard", async () => {
    const write = vi.fn(async () => undefined);
    Object.assign(navigator, {
      clipboard: { write }
    });
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor(public items: Record<string, Blob>) {}
      }
    );
    vi.stubGlobal(
      "fetch",
      async () =>
        ({
          blob: async () => new Blob(["png"], { type: "image/png" })
        }) as Response
    );
    await copyPngDataUrl("data:image/png;base64,xx");
    expect(write).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("names screenshot downloads from the clock", () => {
    expect(screenshotFilename(new Date(2026, 7, 30, 12, 4, 5))).toBe(
      "preview-20260830-120405.png"
    );
  });
});
