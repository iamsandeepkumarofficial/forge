import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createRef, type RefObject } from "react";
import { useWebPreviewInspect } from "./use-web-preview-inspect";

vi.mock("./preview-overflow.js", () => ({
  captureInspectFrameShot: vi.fn(async () => null)
}));

vi.mock("./preview-pick.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./preview-pick.js")>();
  return {
    ...actual,
    capturePickShot: vi.fn(async () => null),
    pickShotRect: vi.fn(() => null)
  };
});

describe("useWebPreviewInspect", () => {
  it("forwards inspect nav messages into history setters", () => {
    const setHistory = vi.fn();
    const setHistIndex = vi.fn();
    const setAddress = vi.fn();
    const addressRef = {
      current: "http://localhost:3000/"
    } as RefObject<string>;
    const historyRef = {
      current: ["http://localhost:3000/"]
    } as RefObject<string[]>;
    const histIndexRef = { current: 0 } as RefObject<number>;
    renderHook(() =>
      useWebPreviewInspect({
        commenting: false,
        cropping: false,
        appUrl: "http://localhost:3000/",
        address: "http://localhost:3000/",
        reloadNonce: 0,
        cacheBust: 0,
        addressRef,
        historyRef,
        histIndexRef,
        iframeRef: createRef() as RefObject<HTMLIFrameElement | null>,
        setCommenting: vi.fn(),
        setCropping: vi.fn(),
        setPick: vi.fn(),
        setDraft: vi.fn(),
        setHistory,
        setHistIndex,
        setAddress
      })
    );
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "http://localhost:3000",
          data: {
            type: "forge-inspect-nav",
            url: "http://localhost:3000/about"
          }
        })
      );
    });
    expect(setAddress).toHaveBeenCalledWith("http://localhost:3000/about");
    expect(setHistIndex).toHaveBeenCalledWith(1);
  });

  it("clears commenting on Escape", () => {
    const setCommenting = vi.fn();
    const setPick = vi.fn();
    const setDraft = vi.fn();
    renderHook(() =>
      useWebPreviewInspect({
        commenting: true,
        cropping: false,
        appUrl: "http://localhost:3000/",
        address: "http://localhost:3000/",
        reloadNonce: 0,
        cacheBust: 0,
        addressRef: createRef() as RefObject<string>,
        historyRef: createRef() as RefObject<string[]>,
        histIndexRef: createRef() as RefObject<number>,
        iframeRef: createRef() as RefObject<HTMLIFrameElement | null>,
        setCommenting,
        setCropping: vi.fn(),
        setPick,
        setDraft,
        setHistory: vi.fn(),
        setHistIndex: vi.fn(),
        setAddress: vi.fn()
      })
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(setCommenting).toHaveBeenCalledWith(false);
    expect(setPick).toHaveBeenCalledWith(null);
  });
});
