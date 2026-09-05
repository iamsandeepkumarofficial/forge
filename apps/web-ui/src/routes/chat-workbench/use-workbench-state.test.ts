import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useWorkbenchDocs,
  useWorkbenchSplit,
  useWorkbenchChrome
} from "./use-workbench-state";
import { PREVIEW_TAB_ID } from "./right-tabs";

describe("useWorkbenchDocs", () => {
  it("opens file and diff tabs", () => {
    const { result } = renderHook(() => useWorkbenchDocs());
    expect(result.current.activeRight).toBe(PREVIEW_TAB_ID);
    act(() => {
      result.current.openFile("src/a.ts");
    });
    expect(result.current.activeDoc).toMatchObject({
      kind: "file",
      path: "src/a.ts"
    });
    act(() => {
      result.current.openDiff("web", "src/b.ts");
    });
    expect(result.current.docs).toHaveLength(2);
    expect(result.current.activeDoc).toMatchObject({
      kind: "diff",
      repo: "web",
      path: "src/b.ts"
    });
  });
});

describe("useWorkbenchSplit", () => {
  it("adapts left percent when preview becomes live", () => {
    const { result, rerender } = renderHook(
      ({ previewLive }) => useWorkbenchSplit({ previewLive }),
      { initialProps: { previewLive: false } }
    );
    const idle = result.current.leftPct;
    rerender({ previewLive: true });
    expect(result.current.leftPct).not.toBe(idle);
    act(() => {
      result.current.markUserOverride();
      result.current.setLeftPct(40);
    });
    expect(result.current.leftPct).toBe(40);
  });
});

describe("useWorkbenchChrome", () => {
  it("notifies chrome listeners when turn status changes", () => {
    const onChromeChange = vi.fn();
    const { result } = renderHook(() => useWorkbenchChrome({ onChromeChange }));
    act(() => {
      result.current.setTurnStatus("running");
    });
    expect(onChromeChange).toHaveBeenCalledWith({ turnStatus: "running" });
  });
});
