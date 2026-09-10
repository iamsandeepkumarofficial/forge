import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  acquirePreviewOverlayLock,
  previewOverlayLocked,
  resetPreviewOverlayLockForTests,
  usePreviewOverlayLocked
} from "./preview-overlay-lock";

describe("preview-overlay-lock", () => {
  afterEach(() => {
    resetPreviewOverlayLockForTests();
  });

  it("tracks nested acquire/release", () => {
    expect(previewOverlayLocked()).toBe(false);
    const release1 = acquirePreviewOverlayLock();
    expect(previewOverlayLocked()).toBe(true);
    const release2 = acquirePreviewOverlayLock();
    release1();
    expect(previewOverlayLocked()).toBe(true);
    release2();
    expect(previewOverlayLocked()).toBe(false);
  });

  it("notifies the hook when lock changes", () => {
    const { result } = renderHook(() => usePreviewOverlayLocked());
    expect(result.current).toBe(false);
    let release: (() => void) | undefined;
    act(() => {
      release = acquirePreviewOverlayLock();
    });
    expect(result.current).toBe(true);
    act(() => {
      release?.();
    });
    expect(result.current).toBe(false);
  });
});
