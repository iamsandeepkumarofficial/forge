import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  usePreviewHistoryRefs,
  usePreviewNavHandler
} from "./use-preview-history-refs";
import type { RefObject } from "react";

describe("usePreviewHistoryRefs", () => {
  it("keeps refs aligned with latest history values", () => {
    const { result, rerender } = renderHook(
      ({ history, histIndex, address }) =>
        usePreviewHistoryRefs({ history, histIndex, address }),
      {
        initialProps: {
          history: ["http://localhost:3000/"],
          histIndex: 0,
          address: "http://localhost:3000/"
        }
      }
    );
    expect(result.current.addressRef.current).toBe("http://localhost:3000/");
    rerender({
      history: ["http://localhost:3000/", "http://localhost:3000/about"],
      histIndex: 1,
      address: "http://localhost:3000/about"
    });
    expect(result.current.histIndexRef.current).toBe(1);
    expect(result.current.historyRef.current).toHaveLength(2);
  });
});

describe("usePreviewNavHandler", () => {
  it("pushes distinct navigation urls into history", () => {
    const setAddress = vi.fn();
    const setHistIndex = vi.fn();
    let stack = ["http://localhost:3000/"];
    const setHistory = vi.fn((fn: (s: string[]) => string[]) => {
      stack = fn(stack);
    });
    const histIndexRef = { current: 0 } as RefObject<number>;
    const { result } = renderHook(() =>
      usePreviewNavHandler({
        histIndexRef,
        setAddress,
        setHistory,
        setHistIndex
      })
    );
    act(() => {
      result.current({
        url: "http://localhost:3000/about",
        canGoBack: true,
        canGoForward: false
      });
    });
    expect(setAddress).toHaveBeenCalledWith("http://localhost:3000/about");
    expect(stack).toEqual([
      "http://localhost:3000/",
      "http://localhost:3000/about"
    ]);
  });

  it("ignores blank urls", () => {
    const setAddress = vi.fn();
    const { result } = renderHook(() =>
      usePreviewNavHandler({
        histIndexRef: { current: 0 } as RefObject<number>,
        setAddress,
        setHistory: vi.fn(),
        setHistIndex: vi.fn()
      })
    );
    act(() => {
      result.current({
        url: "about:blank",
        canGoBack: false,
        canGoForward: false
      });
    });
    expect(setAddress).not.toHaveBeenCalled();
  });
});
