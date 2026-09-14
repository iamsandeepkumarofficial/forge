import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import {
  PreviewElectronFrame,
  PreviewIframeFrame
} from "./web-preview-frame-parts";

vi.mock("./electron-preview-hole.js", () => ({
  ElectronPreviewHole: (props: { url: string; visible: boolean }) => (
    <div data-testid="electron-hole">
      {props.url}:{String(props.visible)}
    </div>
  )
}));

describe("web-preview-frame-parts", () => {
  it("renders an iframe with title and src", () => {
    const iframeRef = createRef<HTMLIFrameElement>();
    render(
      <PreviewIframeFrame
        iframeRef={iframeRef}
        committedUrl="http://app.test/"
        reloadNonce={1}
        cacheBust={2}
        iframeSrc="http://app.test/?v=2"
        activeName="web"
        zoom={100}
      />
    );
    const frame = screen.getByTitle("web preview") as HTMLIFrameElement;
    expect(frame.getAttribute("src")).toBe("http://app.test/?v=2");
  });

  it("renders the electron frame hole", () => {
    render(
      <PreviewElectronFrame
        loadedUrl="http://app.test/"
        zoom={100}
        reloadNonce={0}
        cacheBust={0}
        commenting={false}
        visible
        onPreviewNavigated={() => undefined}
        onPreviewPick={() => undefined}
      />
    );
    expect(screen.getByTestId("electron-hole").textContent).toBe(
      "http://app.test/:true"
    );
  });
});
