import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTerminalTabs } from "./use-terminal-tabs";
import { TERMINAL_ACTIVE_TAB_PREFIX } from "./storage";

const refreshTabsStable = vi.fn(async () => []);
const setTabs = vi.fn();
const setError = vi.fn();

vi.mock("./use-terminal-tab-refresh.js", () => ({
  useTerminalTabRefresh: () => ({
    tabs: [
      {
        id: "sh-1",
        kind: "shell",
        label: "Shell",
        running: true,
        closable: true
      }
    ],
    setTabs,
    loading: false,
    error: null,
    setError,
    refreshTabsStable
  })
}));

vi.mock("./use-terminal-open-events.js", () => ({
  useTerminalOpenEvents: vi.fn()
}));

vi.mock("./terminal-tab-actions.js", () => ({
  createTerminalShellTab: vi.fn(),
  closeTerminalTab: vi.fn()
}));

describe("useTerminalTabs", () => {
  beforeEach(() => {
    localStorage.clear();
    setTabs.mockReset();
    setError.mockReset();
    refreshTabsStable.mockClear();
  });

  it("returns refreshed tabs and idle busy state", () => {
    const { result } = renderHook(() => useTerminalTabs("s1"));
    expect(result.current.tabs).toEqual([
      expect.objectContaining({ id: "sh-1", kind: "shell" })
    ]);
    expect(result.current.busy).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("selectTab persists the active tab id", () => {
    const { result } = renderHook(() => useTerminalTabs("s1"));
    act(() => {
      result.current.selectTab("sh-1");
    });
    expect(result.current.activeTabId).toBe("sh-1");
    expect(localStorage.getItem(`${TERMINAL_ACTIVE_TAB_PREFIX}s1`)).toBe(
      "sh-1"
    );
  });
});
