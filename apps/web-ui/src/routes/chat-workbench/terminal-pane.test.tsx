import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TerminalPane } from "./terminal-pane";

vi.mock("./terminal-xterm-view.js", () => ({
  ShellXtermPane: ({ tabId }: { tabId: string }) => (
    <div data-testid={`shell-xterm-${tabId}`} />
  ),
  AppLogXtermPane: ({ tabId }: { tabId: string }) => (
    <div data-testid={`follow-xterm-${tabId}`} />
  ),
  JobLogXtermPane: ({ tabId }: { tabId: string }) => (
    <div data-testid={`job-log-xterm-${tabId}`} />
  )
}));

const mocks = vi.hoisted(() => ({
  listTerminalTabs: vi.fn(async () => [
    {
      id: "main",
      kind: "shell",
      label: "Shell",
      running: false,
      closable: false
    },
    {
      id: "app:web",
      kind: "app",
      label: "web",
      running: true,
      closable: true,
      stoppable: true
    }
  ]),
  createShellTab: vi.fn(async () => ({
    tabId: "sh-new",
    tab: {
      id: "sh-new",
      kind: "shell",
      label: "sh-new",
      running: false,
      closable: true
    }
  })),
  closeShellTab: vi.fn(async () => undefined)
}));

vi.mock("../../lib/tool-runner.js", () => ({
  stopApp: vi.fn(async () => undefined)
}));

vi.mock("../../lib/session-terminal.js", () => ({
  listTerminalTabs: mocks.listTerminalTabs,
  createShellTab: mocks.createShellTab,
  closeShellTab: mocks.closeShellTab
}));

vi.mock("../../lib/terminal-session-registry.js", () => {
  const client = {
    connect() {
      return undefined;
    },
    disconnect() {
      return undefined;
    },
    subscribe() {
      return () => undefined;
    }
  };
  return {
    retainTerminalSessionClient: () => client,
    releaseTerminalSessionClient: () => undefined,
    getTerminalSessionClient: () => client
  };
});

vi.mock("./tracked-terminals.js", () => {
  const trackedApps = new Set<string>();
  return {
    isBackgroundJobTracked: () => false,
    listTrackedBackgroundJobs: () => [],
    listTrackedApps: () => [...trackedApps],
    subscribeTrackedTerminals: () => () => undefined,
    trackApp: (_sessionId: string, name: string) => {
      trackedApps.add(name);
    },
    __resetTrackedAppsForTest: () => trackedApps.clear()
  };
});

describe("TerminalPane", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const tracked = await import("./tracked-terminals.js");
    (
      tracked as { __resetTrackedAppsForTest?: () => void }
    ).__resetTrackedAppsForTest?.();
  });

  it("renders a vertical tab list with shell and app panes", async () => {
    render(
      <TerminalPane sessionId="s1" visible fitSignal={0} />
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Shell" })).toBeTruthy();
    });
    expect(screen.getByTestId("terminal-tab-list")).toBeTruthy();
    expect(
      screen.getByRole("separator", { name: "Resize terminal tab list" })
    ).toBeTruthy();
    expect(screen.getByText("web")).toBeTruthy();
    expect(screen.getByLabelText("Running")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stop web" })).toBeNull();
    expect(screen.getByTestId("shell-xterm-main")).toBeTruthy();
    expect(screen.getByTestId("follow-xterm-app:web")).toBeTruthy();
  });

  it("creates a new shell tab", async () => {
    render(
      <TerminalPane sessionId="s1" visible fitSignal={0} />
    );
    await waitFor(() => {
      expect(screen.getByLabelText("New shell tab")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("New shell tab"));
    await waitFor(() => {
      expect(mocks.createShellTab).toHaveBeenCalledWith("s1");
    });
    expect(await screen.findByRole("button", { name: "sh-new" })).toBeTruthy();
  });
});
