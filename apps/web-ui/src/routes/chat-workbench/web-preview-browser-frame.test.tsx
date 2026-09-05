import { createRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserPreviewFrame } from "./web-preview-browser-frame";
import type { ShotRect } from "./preview-overflow.js";

vi.mock("./web-preview-pick-freeze.js", () => ({
  PreviewPickFreeze: ({ pick }: { pick: unknown }) =>
    pick ? <div data-testid="pick-freeze" /> : null
}));

vi.mock("./web-preview-frame-parts.js", () => ({
  PreviewElectronFrame: (props: { loadedUrl: string; visible: boolean }) => (
    <div data-testid="electron-frame">
      {props.loadedUrl}:{String(props.visible)}
    </div>
  ),
  PreviewIframeFrame: (props: { iframeSrc: string; activeName?: string }) => (
    <div data-testid="iframe-frame">
      {props.activeName}:{props.iframeSrc}
    </div>
  )
}));

vi.mock("./preview-overflow-menu.js", () => ({
  AreaCropOverlay: ({
    onComplete
  }: {
    onComplete: (rect: ShotRect | null) => void;
  }) => (
    <button
      type="button"
      data-testid="crop-overlay"
      onClick={() => onComplete({ x: 1, y: 2, w: 3, h: 4 })}
    >
      crop
    </button>
  )
}));

function renderFrame(
  overrides: Partial<Parameters<typeof BrowserPreviewFrame>[0]> = {}
) {
  const props = {
    iframeBoxRef: createRef<HTMLDivElement | null>(),
    iframeRef: createRef<HTMLIFrameElement | null>(),
    pick: null,
    electron: false,
    loadedUrl: "http://app.test/",
    zoom: 100,
    reloadNonce: 0,
    cacheBust: 0,
    commenting: false,
    showBrowser: true,
    cropping: false,
    iframeSrc: "http://app.test/?v=1",
    committedUrl: "http://app.test/",
    activeName: "web",
    onPreviewNavigated: vi.fn(),
    onPreviewPick: vi.fn(),
    setCropping: vi.fn(),
    takeShot: vi.fn(async () => undefined),
    ...overrides
  };
  render(<BrowserPreviewFrame {...props} />);
  return props;
}

describe("BrowserPreviewFrame", () => {
  it("renders the iframe frame by default", () => {
    renderFrame();
    expect(screen.getByTestId("iframe-frame").textContent).toBe(
      "web:http://app.test/?v=1"
    );
    expect(screen.queryByTestId("electron-frame")).toBeNull();
  });

  it("renders the electron frame when electron is true", () => {
    renderFrame({ electron: true, loadedUrl: "http://desktop.test/" });
    expect(screen.getByTestId("electron-frame").textContent).toBe(
      "http://desktop.test/:true"
    );
    expect(screen.queryByTestId("iframe-frame")).toBeNull();
  });

  it("shows the crop overlay and completes a shot", () => {
    const props = renderFrame({ cropping: true });
    fireEvent.click(screen.getByTestId("crop-overlay"));
    expect(props.setCropping).toHaveBeenCalledWith(false);
    expect(props.takeShot).toHaveBeenCalledWith({ x: 1, y: 2, w: 3, h: 4 });
  });
});
