import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useTerminalTabRefresh } from "./use-terminal-tab-refresh";
import { resetTrackedTerminalsForTests } from "./tracked-terminals";
import { resetTerminalSessionRegistryForTests } from "../../lib/terminal-session-registry";

const listTerminalTabs = vi.fn();

vi.mock("../../lib/session-terminal.js", () => ({
  listTerminalTabs: (...args: unknown[]) => listTerminalTabs(...args)
}));

vi.mock("../../lib/terminal-session-client.js", () => ({
  streamIdForJobTab: (name: string) => `job:${name}`,
  streamIdForAppTab: (tabId: string) => tabId,
  TerminalSessionClient: class {
    subscribe() {
      return () => undefined;
    }
  }
}));

describe("useTerminalTabRefresh", () => {
  beforeEach(() => {
    listTerminalTabs.mockReset();
    resetTrackedTerminalsForTests();
    resetTerminalSessionRegistryForTests();
  });

  it("loads tabs from the session api", async () => {
    listTerminalTabs.mockResolvedValue([
      {
        id: "sh-1",
        kind: "shell",
        label: "Shell",
        running: true,
        closable: true
      }
    ]);
    const { result } = renderHook(() => useTerminalTabRefresh("s1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tabs).toEqual([
      expect.objectContaining({ id: "sh-1", kind: "shell" })
    ]);
    expect(result.current.error).toBeNull();
  });

  it("surfaces refresh errors", async () => {
    listTerminalTabs.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useTerminalTabRefresh("s1"));
    await waitFor(() => expect(result.current.error).toBe("offline"));
    expect(result.current.loading).toBe(false);
  });

  it("does not keep job tabs from a previous session", async () => {
    listTerminalTabs.mockResolvedValue([
      {
        id: "main",
        kind: "shell",
        label: "Shell",
        running: false,
        closable: false
      }
    ]);
    const { result, rerender } = renderHook(
      ({ sessionId }) => useTerminalTabRefresh(sessionId),
      { initialProps: { sessionId: "s1" } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.setTabs((prev) => [
        ...prev,
        {
          id: "job:install",
          kind: "job",
          label: "install",
          running: false,
          closable: true
        }
      ]);
    });
    expect(result.current.tabs.some((tab) => tab.id === "job:install")).toBe(
      true
    );
    rerender({ sessionId: "s2" });
    await waitFor(() => {
      expect(result.current.tabs.some((tab) => tab.id === "job:install")).toBe(
        false
      );
    });
  });
});
