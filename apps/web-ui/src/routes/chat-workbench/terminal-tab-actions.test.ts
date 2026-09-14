import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import {
  closeTerminalTab,
  createTerminalShellTab
} from "./terminal-tab-actions";
import type { TerminalTab } from "../../lib/session-terminal.js";

const createShellTab = vi.fn();
const closeShellTab = vi.fn();

vi.mock("../../lib/session-terminal.js", () => ({
  createShellTab: (...args: unknown[]) => createShellTab(...args),
  closeShellTab: (...args: unknown[]) => closeShellTab(...args)
}));

const shellTab: TerminalTab = {
  id: "sh-1",
  kind: "shell",
  label: "Shell",
  running: true,
  closable: true
};

describe("terminal-tab-actions", () => {
  beforeEach(() => {
    createShellTab.mockReset();
    closeShellTab.mockReset();
  });

  it("creates a shell tab and selects it", async () => {
    createShellTab.mockResolvedValue({ tabId: "sh-1", tab: shellTab });
    const setBusy = vi.fn();
    const setTabs = vi.fn((fn: (prev: TerminalTab[]) => TerminalTab[]) =>
      fn([])
    );
    const selectTab = vi.fn();
    const setError = vi.fn();
    await createTerminalShellTab({
      sessionId: "s1",
      busy: false,
      setBusy,
      setTabs: setTabs as unknown as Dispatch<SetStateAction<TerminalTab[]>>,
      selectTab,
      setError
    });
    expect(createShellTab).toHaveBeenCalledWith("s1");
    expect(selectTab).toHaveBeenCalledWith("sh-1");
    expect(setError).toHaveBeenCalledWith(null);
    expect(setBusy).toHaveBeenLastCalledWith(false);
  });

  it("skips create when busy and closes job tabs locally", async () => {
    await createTerminalShellTab({
      sessionId: "s1",
      busy: true,
      setBusy: vi.fn(),
      setTabs: vi.fn() as unknown as Dispatch<SetStateAction<TerminalTab[]>>,
      selectTab: vi.fn(),
      setError: vi.fn()
    });
    expect(createShellTab).not.toHaveBeenCalled();

    const setTabs = vi.fn((fn: (prev: TerminalTab[]) => TerminalTab[]) =>
      fn([
        shellTab,
        {
          id: "job:build",
          kind: "job",
          label: "build",
          running: true,
          closable: true
        }
      ])
    );
    await closeTerminalTab({
      sessionId: "s1",
      tab: {
        id: "job:build",
        kind: "job",
        label: "build",
        running: true,
        closable: true
      },
      setBusy: vi.fn(),
      setTabs: setTabs as unknown as Dispatch<SetStateAction<TerminalTab[]>>,
      setHidden: vi.fn() as unknown as Dispatch<SetStateAction<Set<string>>>,
      setError: vi.fn(),
      refreshTabs: vi.fn(async () => undefined)
    });
    expect(
      setTabs.mock.calls[0]![0]!([
        shellTab,
        {
          id: "job:build",
          kind: "job",
          label: "build",
          running: true,
          closable: true
        }
      ])
    ).toEqual([shellTab]);
    expect(closeShellTab).not.toHaveBeenCalled();
  });
});
