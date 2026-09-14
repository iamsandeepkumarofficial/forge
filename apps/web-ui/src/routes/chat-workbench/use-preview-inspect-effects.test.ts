import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";
import {
  usePreviewEscapeKey,
  usePreviewInspectPost
} from "./use-preview-inspect-effects";

describe("usePreviewEscapeKey", () => {
  it("clears commenting state on Escape", () => {
    const setCommenting = vi.fn();
    const setCropping = vi.fn();
    const setPick = vi.fn();
    const setDraft = vi.fn();
    renderHook(() =>
      usePreviewEscapeKey({
        commenting: true,
        cropping: false,
        setCommenting,
        setCropping,
        setPick,
        setDraft
      })
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(setCommenting).toHaveBeenCalledWith(false);
    expect(setPick).toHaveBeenCalledWith(null);
    expect(setDraft).toHaveBeenCalledWith("");
  });
});

describe("usePreviewInspectPost", () => {
  it("posts inspect mode to the iframe", () => {
    const iframe = document.createElement("iframe");
    const postMessage = vi.fn();
    Object.defineProperty(iframe, "contentWindow", {
      value: { postMessage }
    });
    const iframeRef = createRef<HTMLIFrameElement>();
    (iframeRef as { current: HTMLIFrameElement }).current = iframe;
    renderHook(() =>
      usePreviewInspectPost({
        commenting: true,
        appUrl: "http://localhost:3000/",
        address: "http://localhost:3000/",
        reloadNonce: 1,
        cacheBust: 0,
        iframeRef
      })
    );
    expect(postMessage).toHaveBeenCalledWith(
      { type: "forge-inspect-set", on: true },
      "http://localhost:3000"
    );
  });
});
