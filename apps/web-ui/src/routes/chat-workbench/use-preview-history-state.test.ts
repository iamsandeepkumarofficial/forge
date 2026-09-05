import { describe, expect, it } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePreviewHistoryState } from "./use-preview-history-state";

describe("usePreviewHistoryState", () => {
  it("submits address into history and clears to current", async () => {
    const { result } = renderHook(() =>
      usePreviewHistoryState({
        active: {
          name: "web",
          url: "http://localhost:3000/",
          running: true
        } as never,
        surface: "browser",
        appUrl: "http://localhost:3000/"
      })
    );
    await waitFor(() =>
      expect(result.current.address).toBe("http://localhost:3000/")
    );
    act(() => {
      result.current.submitAddress("/about");
    });
    expect(result.current.address).toBe("http://localhost:3000/about");
    expect(result.current.history).toContain("http://localhost:3000/about");
    act(() => {
      result.current.clearHistoryTo("http://localhost:3000/about");
    });
    expect(result.current.history).toEqual(["http://localhost:3000/about"]);
    expect(result.current.histIndex).toBe(0);
  });

  it("exposes committedUrl from history index", async () => {
    const { result } = renderHook(() =>
      usePreviewHistoryState({
        active: {
          name: "web",
          url: "http://localhost:3000/",
          running: true
        } as never,
        surface: "browser",
        appUrl: "http://localhost:3000/"
      })
    );
    await waitFor(() => expect(result.current.pageUrl).toBeTruthy());
    act(() => {
      result.current.submitAddress("/a");
      result.current.submitAddress("/b");
    });
    act(() => {
      result.current.goHistory(0);
    });
    expect(result.current.committedUrl).toBe(result.current.history[0]);
  });
});
