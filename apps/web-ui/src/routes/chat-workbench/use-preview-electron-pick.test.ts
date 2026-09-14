import { describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePreviewElectronPick } from "./use-preview-electron-pick";

vi.mock("./preview-pick.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./preview-pick.js")>();
  return {
    ...actual,
    pickFromElectron: vi.fn(() => ({
      pick: {
        url: "http://localhost:3000/",
        tag: "button",
        selector: "#go",
        text: "Go"
      },
      rect: null
    })),
    capturePickShot: vi.fn(async () => null)
  };
});

describe("usePreviewElectronPick", () => {
  it("sets pick from electron result without previewApi", () => {
    const setPick = vi.fn();
    const { result } = renderHook(() =>
      usePreviewElectronPick({ previewApi: null, setPick })
    );
    act(() => {
      result.current({
        url: "http://localhost:3000/",
        tag: "button",
        selector: "#go",
        text: "Go"
      } as never);
    });
    expect(setPick).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "button", selector: "#go" })
    );
  });

  it("attaches pageShot when previewApi succeeds", async () => {
    const setPick = vi.fn((fn: unknown) => {
      if (typeof fn === "function") {
        return (fn as (c: unknown) => unknown)({
          url: "/",
          tag: "div",
          selector: "",
          text: ""
        });
      }
      return fn;
    });
    const capturePage = vi.fn(async () => "data:image/png;base64,page");
    const { result } = renderHook(() =>
      usePreviewElectronPick({
        previewApi: { capturePage },
        setPick
      })
    );
    act(() => {
      result.current({
        url: "http://localhost:3000/",
        tag: "button",
        selector: "#go",
        text: "Go"
      } as never);
    });
    await waitFor(() => expect(capturePage).toHaveBeenCalled());
    expect(setPick).toHaveBeenCalled();
  });
});
