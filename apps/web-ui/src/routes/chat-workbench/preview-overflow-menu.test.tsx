import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PreviewOverflowMenu } from "./preview-overflow-menu";

describe("PreviewOverflowMenu", () => {
  afterEach(() => {
    delete (window as { forgeDesktop?: unknown }).forgeDesktop;
  });

  it("opens and lists screenshot, reload, zoom, and cleanup actions", async () => {
    const onTakeScreenshot = vi.fn();
    const onHardReload = vi.fn();
    const onZoomIn = vi.fn();
    render(
      <PreviewOverflowMenu
        zoom={100}
        onTakeScreenshot={onTakeScreenshot}
        onCaptureArea={vi.fn()}
        onHardReload={onHardReload}
        onCopyUrl={vi.fn()}
        onZoomIn={onZoomIn}
        onZoomOut={vi.fn()}
        onZoomReset={vi.fn()}
        onClearHistory={vi.fn()}
        onClearCookies={vi.fn()}
        onClearCache={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview options" }));
    await waitFor(() => {
      expect(screen.getByText("Take Screenshot")).toBeTruthy();
      expect(screen.getByText("Capture Area Screenshot")).toBeTruthy();
      expect(screen.getByText("Hard Reload")).toBeTruthy();
      expect(screen.getByText("Copy Current URL")).toBeTruthy();
      expect(screen.getByText("Zoom")).toBeTruthy();
      expect(screen.getByText("100%")).toBeTruthy();
      expect(screen.getByText("Clear Browsing History")).toBeTruthy();
      expect(screen.getByText("Clear Cookies")).toBeTruthy();
      expect(screen.getByText("Clear Cache")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Take Screenshot"));
    await waitFor(() => {
      expect(onTakeScreenshot).toHaveBeenCalled();
    });
  });

  it("uses the native electron menu when the bridge is present", async () => {
    const showOverflowMenu = vi.fn(async () => "hardReload");
    const onHardReload = vi.fn();
    window.forgeDesktop = {
      pickFolder: async () => null,
      preview: { showOverflowMenu } as never
    };
    render(
      <PreviewOverflowMenu
        zoom={100}
        onTakeScreenshot={vi.fn()}
        onCaptureArea={vi.fn()}
        onHardReload={onHardReload}
        onCopyUrl={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onZoomReset={vi.fn()}
        onClearHistory={vi.fn()}
        onClearCookies={vi.fn()}
        onClearCache={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview options" }));
    await waitFor(() => {
      expect(showOverflowMenu).toHaveBeenCalled();
      expect(onHardReload).toHaveBeenCalled();
    });
    expect(screen.queryByText("Take Screenshot")).toBeNull();
  });

  it("keeps the menu open while changing zoom", async () => {
    const onZoomIn = vi.fn();
    render(
      <PreviewOverflowMenu
        zoom={100}
        onTakeScreenshot={vi.fn()}
        onCaptureArea={vi.fn()}
        onHardReload={vi.fn()}
        onCopyUrl={vi.fn()}
        onZoomIn={onZoomIn}
        onZoomOut={vi.fn()}
        onZoomReset={vi.fn()}
        onClearHistory={vi.fn()}
        onClearCookies={vi.fn()}
        onClearCache={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview options" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Zoom in")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(onZoomIn).toHaveBeenCalled();
    expect(screen.getByText("Zoom")).toBeTruthy();
  });
});
