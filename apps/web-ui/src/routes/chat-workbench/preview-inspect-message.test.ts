import { describe, expect, it, vi } from "vitest";
import { createRef, type RefObject } from "react";
import { handlePreviewInspectMessage } from "./preview-inspect-message";

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

function emptyRefs() {
  return {
    addressRef: createRef() as RefObject<string>,
    historyRef: createRef() as RefObject<string[]>,
    histIndexRef: createRef() as RefObject<number>,
    iframeRef: createRef() as RefObject<HTMLIFrameElement | null>
  };
}

describe("handlePreviewInspectMessage", () => {
  it("ignores messages from other origins", () => {
    const setAddress = vi.fn();
    handlePreviewInspectMessage({
      e: {
        origin: "https://evil.example",
        data: { type: "forge-inspect-nav", url: "http://localhost:3000/x" }
      } as MessageEvent,
      origin: "http://localhost:3000",
      commenting: false,
      ...emptyRefs(),
      setHistory: vi.fn(),
      setHistIndex: vi.fn(),
      setAddress,
      setPick: vi.fn()
    });
    expect(setAddress).not.toHaveBeenCalled();
  });

  it("pushes navigation into preview history", () => {
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
    handlePreviewInspectMessage({
      e: {
        origin: "http://localhost:3000",
        data: { type: "forge-inspect-nav", url: "http://localhost:3000/about" }
      } as MessageEvent,
      origin: "http://localhost:3000",
      commenting: false,
      addressRef,
      historyRef,
      histIndexRef,
      iframeRef: createRef() as RefObject<HTMLIFrameElement | null>,
      setHistory,
      setHistIndex,
      setAddress,
      setPick: vi.fn()
    });
    expect(setAddress).toHaveBeenCalledWith("http://localhost:3000/about");
    expect(setHistIndex).toHaveBeenCalledWith(1);
    expect(setHistory).toHaveBeenCalledWith([
      "http://localhost:3000/",
      "http://localhost:3000/about"
    ]);
  });

  it("stores a pick while commenting", () => {
    const setPick = vi.fn();
    handlePreviewInspectMessage({
      e: {
        origin: "http://localhost:3000",
        data: {
          type: "forge-inspect-pick",
          url: "http://localhost:3000/",
          tag: "button",
          selector: "#go",
          text: "Go"
        }
      } as MessageEvent,
      origin: "http://localhost:3000",
      commenting: true,
      ...emptyRefs(),
      setHistory: vi.fn(),
      setHistIndex: vi.fn(),
      setAddress: vi.fn(),
      setPick
    });
    expect(setPick).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://localhost:3000/",
        tag: "button",
        selector: "#go",
        text: "Go"
      })
    );
  });
});
