import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTabListResize } from "./use-tab-list-resize";

function dispatchDocPointer(type: string, clientX: number) {
  const event = new Event(type, { bubbles: true }) as Event & {
    clientX: number;
  };
  Object.defineProperty(event, "clientX", { value: clientX });
  document.dispatchEvent(event);
}

describe("useTabListResize", () => {
  it("starts dragging and updates width", () => {
    localStorage.clear();
    const { result } = renderHook(() => useTabListResize());
    const initial = result.current.width;
    act(() => {
      result.current.startDrag({
        button: 0,
        clientX: 100,
        pointerId: 1,
        preventDefault: vi.fn(),
        currentTarget: {
          setPointerCapture: vi.fn()
        }
      } as never);
    });
    expect(result.current.dragging).toBe(true);
    act(() => {
      dispatchDocPointer("pointermove", 140);
    });
    expect(result.current.width).toBeGreaterThanOrEqual(initial);
    act(() => {
      dispatchDocPointer("pointerup", 140);
    });
    expect(result.current.dragging).toBe(false);
  });
});
