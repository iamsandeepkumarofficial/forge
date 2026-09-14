import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCollapsibleSidebar } from "./use-collapsible-sidebar";

const KEY = "forge.test.sidebar";

describe("useCollapsibleSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("reads collapsed state from localStorage", () => {
    localStorage.setItem(KEY, "1");
    const { result } = renderHook(() => useCollapsibleSidebar(KEY));
    expect(result.current.collapsed).toBe(true);
  });

  it("toggles and persists collapsed state", () => {
    const { result } = renderHook(() => useCollapsibleSidebar(KEY));
    expect(result.current.collapsed).toBe(false);
    act(() => {
      result.current.toggle();
    });
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem(KEY)).toBe("1");
    act(() => {
      result.current.setCollapsed(false);
    });
    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("0");
  });
});
