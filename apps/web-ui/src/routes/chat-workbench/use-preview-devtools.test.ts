import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePreviewDevtools } from "./use-preview-devtools";

const postToPreviewInspect = vi.fn();

vi.mock("./preview-devtools-model.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./preview-devtools-model.js")>();
  return {
    ...actual,
    postToPreviewInspect: (...args: unknown[]) => postToPreviewInspect(...args)
  };
});

describe("usePreviewDevtools", () => {
  beforeEach(() => {
    postToPreviewInspect.mockClear();
  });

  it("collects console messages from the preview", () => {
    const { result } = renderHook(() => usePreviewDevtools());
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "forge-devtools-console",
            level: "error",
            args: ["boom"],
            ts: 1
          }
        })
      );
    });
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.logs[0]).toMatchObject({
      id: "c1",
      level: "error"
    });
  });

  it("toggles select mode and clears the active tab", () => {
    const { result } = renderHook(() => usePreviewDevtools());
    act(() => {
      result.current.toggleSelect();
    });
    expect(result.current.selecting).toBe(true);
    expect(postToPreviewInspect).toHaveBeenCalledWith({
      type: "forge-inspect-set",
      on: true
    });
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "forge-devtools-console",
            level: "log",
            args: ["x"],
            ts: 2
          }
        })
      );
    });
    expect(result.current.logs.length).toBeGreaterThan(0);
    act(() => {
      result.current.clearActive();
    });
    expect(result.current.logs).toEqual([]);
  });
});
