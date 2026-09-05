import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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
});
