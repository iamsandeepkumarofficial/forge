import { describe, it, expect, vi, afterEach } from "vitest";
import {
  openNativePreviewMenu,
  overflowHandlers,
  runPreviewOverflowAction
} from "./preview-overflow-actions";

describe("preview-overflow-actions", () => {
  afterEach(() => {
    delete (window as { forgeDesktop?: unknown }).forgeDesktop;
  });

  it("runs a known action and ignores unknown ones", () => {
    const onHardReload = vi.fn();
    const handlers = overflowHandlers({
      onTakeScreenshot: vi.fn(),
      onCaptureArea: vi.fn(),
      onHardReload,
      onCopyUrl: vi.fn(),
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onZoomReset: vi.fn(),
      onClearHistory: vi.fn(),
      onClearCookies: vi.fn(),
      onClearCache: vi.fn()
    });
    runPreviewOverflowAction("hardReload", handlers);
    runPreviewOverflowAction("nope", handlers);
    runPreviewOverflowAction(null, handlers);
    expect(onHardReload).toHaveBeenCalledTimes(1);
  });

  it("opens the native menu from the trigger rect", async () => {
    const showOverflowMenu = vi.fn(async () => "screenshot");
    const onTakeScreenshot = vi.fn();
    window.forgeDesktop = {
      pickFolder: async () => null,
      preview: { showOverflowMenu } as never
    };
    await openNativePreviewMenu({
      trigger: {
        getBoundingClientRect: () =>
          ({ left: 12, bottom: 40 }) as DOMRect
      },
      zoom: 125,
      handlers: overflowHandlers({
        onTakeScreenshot,
        onCaptureArea: vi.fn(),
        onHardReload: vi.fn(),
        onCopyUrl: vi.fn(),
        onZoomIn: vi.fn(),
        onZoomOut: vi.fn(),
        onZoomReset: vi.fn(),
        onClearHistory: vi.fn(),
        onClearCookies: vi.fn(),
        onClearCache: vi.fn()
      })
    });
    expect(showOverflowMenu).toHaveBeenCalledWith({
      zoom: 125,
      x: 12,
      y: 40
    });
    expect(onTakeScreenshot).toHaveBeenCalled();
  });
});
