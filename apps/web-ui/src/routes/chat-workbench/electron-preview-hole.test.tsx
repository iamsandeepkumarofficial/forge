import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ElectronDevtoolsHole, ElectronPreviewHole } from "./electron-preview-hole";

describe("electron-preview-hole", () => {
  afterEach(() => {
    delete (window as { forgeDesktop?: unknown }).forgeDesktop;
  });

  it("renders the preview hole", () => {
    render(
      <ElectronPreviewHole
        url="http://app.test/"
        zoom={100}
        reloadNonce={0}
        cacheBust={0}
        commenting={false}
        visible
        onNavigated={() => undefined}
        onPick={() => undefined}
      />
    );
    expect(screen.getByTestId("electron-preview-hole")).toBeTruthy();
  });

  it("renders the DevTools hole", () => {
    render(<ElectronDevtoolsHole active />);
    expect(screen.getByTestId("electron-devtools-hole")).toBeTruthy();
  });
});
