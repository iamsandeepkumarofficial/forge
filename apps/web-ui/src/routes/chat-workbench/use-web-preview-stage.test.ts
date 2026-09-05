import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebPreviewStage } from "./use-web-preview-stage";

const bumpCache = vi.fn();
const takeShot = vi.fn();
const onPreviewPick = vi.fn();

vi.mock("../../lib/desktop.js", () => ({
  isElectronPreview: () => false
}));

vi.mock("./use-preview-screenshot.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./use-preview-screenshot.js")>();
  return {
    ...actual,
    previewLoadedUrl: (url: string, bust: number) =>
      bust > 0 ? `${url}?cb=${bust}` : url
  };
});

vi.mock("./use-preview-stage-wiring.js", () => ({
  usePreviewStageWiring: () => ({
    comment: {
      commenting: false,
      cropping: false,
      pick: null,
      draft: "",
      setCommenting: vi.fn(),
      setCropping: vi.fn(),
      setPick: vi.fn(),
      setDraft: vi.fn()
    },
    hist: {
      address: "http://app.test/",
      setAddress: vi.fn(),
      history: ["http://app.test/"],
      histIndex: 0,
      apiPath: "/",
      setApiPath: vi.fn(),
      zoom: 100,
      setZoom: vi.fn(),
      cacheBust: 0,
      submitAddress: vi.fn(),
      goHistory: vi.fn(),
      onPreviewNavigated: vi.fn(),
      clearHistoryTo: vi.fn(),
      pageUrl: "http://app.test/",
      committedUrl: "http://app.test/"
    },
    shot: { chromeNotice: "", takeShot },
    previewApi: null,
    appUrl: "http://app.test/",
    onPreviewPick,
    bumpCache
  })
}));

describe("useWebPreviewStage", () => {
  it("forwards session and surface fields with browser urls", () => {
    const onSelect = vi.fn();
    const onReload = vi.fn();
    const { result } = renderHook(() =>
      useWebPreviewStage({
        sessionId: "s1",
        apps: [
          {
            name: "web",
            url: "http://app.test/",
            running: true
          } as never
        ],
        active: {
          name: "web",
          url: "http://app.test/",
          running: true
        } as never,
        surface: "browser",
        webRunningNoUrl: [],
        reloadNonce: 0,
        onSelect,
        onReload
      })
    );
    expect(result.current.sessionId).toBe("s1");
    expect(result.current.appUrl).toBe("http://app.test/");
    expect(result.current.loadedUrl).toBe("http://app.test/");
    expect(result.current.showBrowser).toBe(true);
    expect(result.current.electron).toBe(false);
    expect(result.current.address).toBe("http://app.test/");
  });

  it("exposes bumpCache and takeShot from wiring", () => {
    const { result } = renderHook(() =>
      useWebPreviewStage({
        sessionId: "s1",
        apps: [],
        active: undefined,
        surface: "none",
        webRunningNoUrl: [],
        reloadNonce: 0,
        onSelect: vi.fn(),
        onReload: vi.fn()
      })
    );
    act(() => {
      result.current.bumpCache();
    });
    expect(bumpCache).toHaveBeenCalled();
    expect(result.current.takeShot).toBe(takeShot);
    expect(result.current.onPreviewPick).toBe(onPreviewPick);
  });
});
