import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useElectronPreviewPage } from "./use-electron-preview";

describe("useElectronPreviewPage", () => {
  afterEach(() => {
    delete (window as { forgeDesktop?: unknown }).forgeDesktop;
  });

  function installPreview(partial: {
    loadURL: ReturnType<typeof vi.fn>;
    reload?: ReturnType<typeof vi.fn>;
    setZoom: ReturnType<typeof vi.fn>;
    setVisible?: ReturnType<typeof vi.fn>;
    startPick: ReturnType<typeof vi.fn>;
    cancelPick: ReturnType<typeof vi.fn>;
  }): void {
    window.forgeDesktop = {
      pickFolder: async () => null,
      preview: {
        loadURL: partial.loadURL,
        reload: partial.reload ?? vi.fn(async () => undefined),
        setZoom: partial.setZoom,
        setVisible: partial.setVisible ?? vi.fn(async () => undefined),
        startPick: partial.startPick,
        cancelPick: partial.cancelPick,
        onNavigated: () => () => undefined
      } as never
    };
  }

  it("loads url and zoom when the preview bridge exists", () => {
    const loadURL = vi.fn(async () => undefined);
    const setZoom = vi.fn(async () => undefined);
    const startPick = vi.fn(async () => null);
    const cancelPick = vi.fn(async () => undefined);
    installPreview({ loadURL, setZoom, startPick, cancelPick });
    renderHook(() =>
      useElectronPreviewPage({
        url: "http://app.test/",
        zoom: 125,
        reloadNonce: 0,
        cacheBust: 0,
        commenting: false,
        onNavigated: vi.fn(),
        onPick: () => undefined
      })
    );
    expect(loadURL).toHaveBeenCalledWith("http://app.test/");
    expect(setZoom).toHaveBeenCalledWith(125);
    expect(startPick).not.toHaveBeenCalled();
  });

  it("reloads when the nonce changes and the url does not", () => {
    const loadURL = vi.fn(async () => undefined);
    const reload = vi.fn(async () => undefined);
    const setZoom = vi.fn(async () => undefined);
    installPreview({
      loadURL,
      reload,
      setZoom,
      startPick: vi.fn(async () => null),
      cancelPick: vi.fn(async () => undefined)
    });
    const { rerender } = renderHook(
      (nonce: number) =>
        useElectronPreviewPage({
          url: "http://app.test/",
          zoom: 100,
          reloadNonce: nonce,
          cacheBust: 0,
          commenting: false,
          onNavigated: vi.fn(),
          onPick: () => undefined
        }),
      { initialProps: 0 }
    );
    expect(loadURL).toHaveBeenCalledTimes(1);
    rerender(1);
    expect(reload).toHaveBeenCalledWith(false);
    expect(loadURL).toHaveBeenCalledTimes(1);
  });

  it("blanks and hides when url clears", async () => {
    const loadURL = vi.fn(async () => undefined);
    const setVisible = vi.fn(async () => undefined);
    const setZoom = vi.fn(async () => undefined);
    installPreview({
      loadURL,
      setVisible,
      setZoom,
      startPick: vi.fn(async () => null),
      cancelPick: vi.fn(async () => undefined)
    });
    const { rerender } = renderHook(
      ({ url }: { url: string }) =>
        useElectronPreviewPage({
          url,
          zoom: 100,
          reloadNonce: 0,
          cacheBust: 0,
          commenting: false,
          onNavigated: vi.fn(),
          onPick: () => undefined
        }),
      { initialProps: { url: "http://app.test/" } }
    );
    rerender({ url: "" });
    await waitFor(() => {
      expect(setVisible).toHaveBeenCalledWith(false);
      expect(loadURL).toHaveBeenCalledWith("about:blank");
    });
  });
});
