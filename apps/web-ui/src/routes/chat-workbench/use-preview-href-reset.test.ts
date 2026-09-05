import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePreviewHrefReset } from "./use-preview-href-reset";
import { ZOOM_DEFAULT } from "./preview-overflow";

describe("usePreviewHrefReset", () => {
  it("resets history when origin changes", async () => {
    const setAddress = vi.fn();
    const setHistIndex = vi.fn();
    const setApiPath = vi.fn();
    const setZoom = vi.fn();
    const setCacheBust = vi.fn();
    let stack = ["http://localhost:3000/"];
    const setHistory = vi.fn((fn: (s: string[]) => string[]) => {
      stack = fn(stack);
    });
    renderHook(() =>
      usePreviewHrefReset({
        previewHref: "http://localhost:4000/",
        setAddress,
        setHistory,
        setHistIndex,
        setApiPath,
        setZoom,
        setCacheBust
      })
    );
    await waitFor(() => expect(stack).toEqual(["http://localhost:4000/"]));
    expect(setAddress).toHaveBeenCalledWith("http://localhost:4000/");
    expect(setHistIndex).toHaveBeenCalledWith(0);
    expect(setApiPath).toHaveBeenCalledWith("/");
    expect(setZoom).toHaveBeenCalledWith(ZOOM_DEFAULT);
    expect(setCacheBust).toHaveBeenCalledWith(0);
  });

  it("keeps history when origin is shared", async () => {
    const setAddress = vi.fn();
    let stack = ["http://localhost:3000/", "http://localhost:3000/about"];
    const setHistory = vi.fn((fn: (s: string[]) => string[]) => {
      stack = fn(stack);
    });
    renderHook(() =>
      usePreviewHrefReset({
        previewHref: "http://localhost:3000/new",
        setAddress,
        setHistory,
        setHistIndex: vi.fn(),
        setApiPath: vi.fn(),
        setZoom: vi.fn(),
        setCacheBust: vi.fn()
      })
    );
    await waitFor(() => expect(setHistory).toHaveBeenCalled());
    expect(stack).toEqual([
      "http://localhost:3000/",
      "http://localhost:3000/about"
    ]);
    expect(setAddress).not.toHaveBeenCalled();
  });
});
