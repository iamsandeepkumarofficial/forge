import { describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createRef } from "react";
import {
  previewLoadedUrl,
  usePreviewScreenshot
} from "./use-preview-screenshot";

vi.mock("./preview-overflow.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./preview-overflow.js")>();
  return {
    ...actual,
    capturePreviewShot: vi.fn(async () => "data:image/png;base64,shot"),
    captureInspectFrameShot: vi.fn(async () => "data:image/png;base64,shot"),
    copyPngDataUrl: vi.fn(async () => undefined)
  };
});

describe("previewLoadedUrl", () => {
  it("returns the committed url when cacheBust is zero", () => {
    expect(previewLoadedUrl("http://app.test/", 0)).toBe("http://app.test/");
  });

  it("appends _forge_cb when cacheBust is positive", () => {
    expect(previewLoadedUrl("http://app.test/path", 3)).toContain(
      "_forge_cb=3"
    );
  });
});

describe("usePreviewScreenshot", () => {
  it("captures via previewApi and sets a notice", async () => {
    const capturePage = vi.fn(async () => "data:image/png;base64,abc");
    const { result } = renderHook(() =>
      usePreviewScreenshot({
        iframeBoxRef: createRef(),
        iframeRef: createRef(),
        previewApi: { capturePage },
        zoom: 100,
        committedUrl: "http://localhost:3000/",
        pageUrl: "http://localhost:3000/"
      })
    );
    await act(async () => {
      await result.current.takeShot();
    });
    expect(capturePage).toHaveBeenCalled();
    await waitFor(() =>
      expect(result.current.chromeNotice).toBe("Screenshot copied")
    );
  });
});
