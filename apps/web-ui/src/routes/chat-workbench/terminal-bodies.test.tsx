import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TerminalBodies } from "./terminal-bodies";
import type { TerminalTab } from "../../lib/session-terminal.js";
import type { TerminalSessionClient } from "../../lib/terminal-session-client.js";

vi.mock("./terminal-xterm-view.js", () => ({
  ShellXtermPane: ({ tabId }: { tabId: string }) => (
    <div data-testid={`shell-xterm-${tabId}`} />
  ),
  AppLogXtermPane: ({ tabId }: { tabId: string }) => (
    <div data-testid={`app-log-${tabId}`} />
  ),
  JobLogXtermPane: ({ tabId }: { tabId: string }) => (
    <div data-testid={`job-log-${tabId}`} />
  )
}));

const client = {} as TerminalSessionClient;

function shellTab(id = "main"): TerminalTab {
  return {
    id,
    kind: "shell",
    label: "Shell",
    running: false,
    closable: false
  };
}

describe("TerminalBodies", () => {
  it("shows loading when loading with no tabs", () => {
    render(
      <TerminalBodies
        loading
        shownTabs={[]}
        sessionClient={null}
        activeTabId={null}
        dockVisible
        paneFitSignal={0}
      />
    );
    expect(screen.getByText("Loading terminals…")).toBeTruthy();
  });

  it("shows empty state when there are no tabs", () => {
    render(
      <TerminalBodies
        loading={false}
        shownTabs={[]}
        sessionClient={client}
        activeTabId={null}
        dockVisible
        paneFitSignal={0}
      />
    );
    expect(
      screen.getByText("No tabs yet. Create a shell tab to start.")
    ).toBeTruthy();
  });

  it("shows connecting when tabs exist without a session client", () => {
    render(
      <TerminalBodies
        loading={false}
        shownTabs={[shellTab()]}
        sessionClient={null}
        activeTabId="main"
        dockVisible
        paneFitSignal={0}
      />
    );
    expect(screen.getByText("Connecting session…")).toBeTruthy();
  });

  it("renders shell and app panes for shown tabs", () => {
    const tabs: TerminalTab[] = [
      shellTab("main"),
      {
        id: "app:web",
        kind: "app",
        label: "web",
        running: true,
        closable: true
      }
    ];
    render(
      <TerminalBodies
        loading={false}
        shownTabs={tabs}
        sessionClient={client}
        activeTabId="main"
        dockVisible
        paneFitSignal={1}
      />
    );
    expect(screen.getByTestId("shell-xterm-main")).toBeTruthy();
    expect(screen.getByTestId("app-log-app:web")).toBeTruthy();
  });
});
