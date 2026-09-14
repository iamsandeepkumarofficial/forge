import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";
import { usePreviewStageWiring } from "./use-preview-stage-wiring";

const setCacheBust = vi.fn();
const onReload = vi.fn();

vi.mock("../../lib/desktop.js", () => ({
  electronPreview: () => null
}));

vi.mock("./use-preview-comment-state.js", () => ({
  usePreviewCommentState: () => ({
    commenting: false,
    cropping: false,
    pick: null,
    draft: "",
    setCommenting: vi.fn(),
    setCropping: vi.fn(),
    setPick: vi.fn(),
    setDraft: vi.fn()
  })
}));

vi.mock("./use-preview-history-state.js", () => ({
  usePreviewHistoryState: () => ({
    zoom: 100,
    committedUrl: "http://app.test/",
    pageUrl: "http://app.test/",
    address: "http://app.test/",
    cacheBust: 0,
    setCacheBust,
    addressRef: { current: "http://app.test/" },
    historyRef: { current: [] },
    histIndexRef: { current: -1 },
    setHistory: vi.fn(),
    setHistIndex: vi.fn(),
    setAddress: vi.fn()
  })
}));

vi.mock("./use-preview-screenshot.js", () => ({
  usePreviewScreenshot: () => ({
    chromeNotice: "",
    takeShot: vi.fn()
  })
}));

vi.mock("./use-web-preview-inspect.js", () => ({
  useWebPreviewInspect: vi.fn()
}));

vi.mock("./use-preview-electron-pick.js", () => ({
  usePreviewElectronPick: () => vi.fn()
}));

describe("usePreviewStageWiring", () => {
  it("exposes hist, comment, shot, and appUrl", () => {
    const { result } = renderHook(() =>
      usePreviewStageWiring({
        active: {
          name: "web",
          url: "http://app.test/",
          running: true
        } as never,
        surface: "browser",
        reloadNonce: 0,
        onReload,
        iframeBoxRef: createRef(),
        iframeRef: createRef()
      })
    );
    expect(result.current.appUrl).toBe("http://app.test/");
    expect(result.current.hist.committedUrl).toBe("http://app.test/");
    expect(result.current.previewApi).toBeNull();
    expect(typeof result.current.bumpCache).toBe("function");
  });

  it("bumpCache increments cache bust and reloads", () => {
    const { result } = renderHook(() =>
      usePreviewStageWiring({
        active: {
          name: "web",
          url: "http://app.test/",
          running: true
        } as never,
        surface: "browser",
        reloadNonce: 1,
        onReload,
        iframeBoxRef: createRef(),
        iframeRef: createRef()
      })
    );
    act(() => {
      result.current.bumpCache();
    });
    expect(setCacheBust).toHaveBeenCalled();
    expect(onReload).toHaveBeenCalled();
  });
});
