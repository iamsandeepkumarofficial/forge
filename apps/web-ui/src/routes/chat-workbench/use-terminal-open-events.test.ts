import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { renderHook, act } from "@testing-library/react";
import { useTerminalOpenEvents } from "./use-terminal-open-events";
import {
  OPEN_TERMINAL_JOB_EVENT,
  OPEN_TERMINAL_TAB_EVENT
} from "./terminal-toggle";
import { resetTrackedTerminalsForTests } from "./tracked-terminals";
import { resetTerminalSessionRegistryForTests } from "../../lib/terminal-session-registry";
import type { TerminalTab } from "../../lib/session-terminal.js";

vi.mock("../../lib/terminal-session-client.js", () => ({
  streamIdForJobTab: (name: string) => `job:${name}`,
  streamIdForAppTab: (tabId: string) => tabId,
  TerminalSessionClient: class {
    connect() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
    subscribe() {
      return () => undefined;
    }
  }
}));

describe("useTerminalOpenEvents", () => {
  beforeEach(() => {
    resetTrackedTerminalsForTests();
    resetTerminalSessionRegistryForTests();
  });

  it("opens a job tab from custom events", () => {
    const selectTab = vi.fn();
    const setTabs = vi.fn((fn: (prev: TerminalTab[]) => TerminalTab[]) =>
      fn([])
    );
    const setHidden = vi.fn((fn: (prev: Set<string>) => Set<string>) =>
      fn(new Set())
    );
    renderHook(() =>
      useTerminalOpenEvents({
        sessionId: "s1",
        selectTab,
        setTabs: setTabs as unknown as Dispatch<SetStateAction<TerminalTab[]>>,
        setHidden: setHidden as unknown as Dispatch<SetStateAction<Set<string>>>
      })
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_TERMINAL_JOB_EVENT, {
          detail: { jobName: "build" }
        })
      );
    });
    expect(selectTab).toHaveBeenCalledWith("job:build");
    expect(setTabs).toHaveBeenCalled();
  });

  it("opens an app tab from tab events", () => {
    const selectTab = vi.fn();
    const setTabs = vi.fn((fn: (prev: TerminalTab[]) => TerminalTab[]) =>
      fn([])
    );
    renderHook(() =>
      useTerminalOpenEvents({
        sessionId: "s1",
        selectTab,
        setTabs: setTabs as unknown as Dispatch<SetStateAction<TerminalTab[]>>,
        setHidden: vi.fn() as unknown as Dispatch<SetStateAction<Set<string>>>
      })
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_TERMINAL_TAB_EVENT, {
          detail: { kind: "app", id: "app:web" }
        })
      );
    });
    expect(selectTab).toHaveBeenCalledWith("app:web");
  });
});
