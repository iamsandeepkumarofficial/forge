import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useResizableSplitDrag } from "./use-resizable-split-drag";
import { SPLIT_KEY } from "./storage";

function dispatchPointer(type: string, clientX: number) {
  const event = new Event(type, { bubbles: true }) as Event & {
    clientX: number;
    clientY: number;
  };
  Object.defineProperty(event, "clientX", { value: clientX });
  Object.defineProperty(event, "clientY", { value: 10 });
  window.dispatchEvent(event);
}

describe("useResizableSplitDrag", () => {
  it("updates left percent while dragging", () => {
    const onLeftPct = vi.fn();
    const onDragStart = vi.fn();
    const { result } = renderHook(() =>
      useResizableSplitDrag({
        leftPct: 40,
        onDragStart,
        onLeftPct,
        onCollapse: vi.fn(),
        onExpand: vi.fn()
      })
    );
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        width: 1000,
        top: 0,
        height: 100,
        right: 1000,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect;
    (result.current.containerRef as { current: HTMLDivElement }).current = el;
    act(() => {
      result.current.start();
    });
    expect(onDragStart).toHaveBeenCalled();
    act(() => {
      dispatchPointer("pointermove", 450);
    });
    expect(onLeftPct).toHaveBeenCalledWith(45);
    act(() => {
      dispatchPointer("pointerup", 450);
    });
    expect(localStorage.getItem(SPLIT_KEY)).toBe("40");
  });

  it("expands collapsed left pane to minimum width", () => {
    const onLeftPct = vi.fn();
    const onExpand = vi.fn();
    const { result } = renderHook(() =>
      useResizableSplitDrag({
        leftPct: 10,
        onDragStart: vi.fn(),
        onLeftPct,
        onCollapse: vi.fn(),
        onExpand
      })
    );
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        width: 1000,
        top: 0,
        height: 100,
        right: 1000,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect;
    (result.current.containerRef as { current: HTMLDivElement }).current = el;
    act(() => {
      result.current.expand();
    });
    expect(onExpand).toHaveBeenCalled();
    expect(onLeftPct).toHaveBeenCalled();
  });
});
