import { createRef } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShellXtermPane } from "./terminal-xterm-shell";
import type { TerminalSessionClient } from "../../lib/terminal-session-client.js";

const streamState = vi.hoisted(() => ({
  connected: false,
  error: null as string | null
}));

vi.mock("./terminal-xterm-helpers.js", () => ({
  fitTerminal: vi.fn(),
  useContainWheel: vi.fn(),
  useXtermHost: () => ({
    hostRef: createRef<HTMLDivElement | null>(),
    termRef: createRef(),
    fitRef: createRef()
  })
}));

vi.mock("./use-xterm-stream.js", () => ({
  useShellStream: () => ({
    connected: streamState.connected,
    error: streamState.error
  })
}));

vi.mock("../../lib/terminal-session-client.js", () => ({
  streamIdForShellTab: (tabId: string) => `shell:${tabId}`
}));

const client = {
  resize: vi.fn()
} as unknown as TerminalSessionClient;

describe("ShellXtermPane", () => {
  beforeEach(() => {
    streamState.connected = false;
    streamState.error = null;
  });

  it("renders the shell host with the tab test id", () => {
    render(
      <ShellXtermPane
        client={client}
        tabId="main"
        active
        visible
        fitSignal={0}
      />
    );
    expect(screen.getByTestId("shell-xterm-main")).toBeTruthy();
  });

  it("shows Connecting overlay while disconnected", () => {
    render(
      <ShellXtermPane
        client={client}
        tabId="sh-1"
        active
        visible
        fitSignal={0}
      />
    );
    expect(screen.getByText("Connecting…")).toBeTruthy();
  });

  it("shows Reconnecting overlay when there is a stream error", () => {
    streamState.error = "socket closed";
    render(
      <ShellXtermPane
        client={client}
        tabId="sh-1"
        active
        visible
        fitSignal={0}
      />
    );
    expect(screen.getByText("Reconnecting…")).toBeTruthy();
    expect(screen.getByText("socket closed")).toBeTruthy();
  });

  it("hides the overlay once connected", () => {
    streamState.connected = true;
    render(
      <ShellXtermPane
        client={client}
        tabId="main"
        active
        visible
        fitSignal={0}
      />
    );
    expect(screen.queryByText("Connecting…")).toBeNull();
    expect(screen.queryByText("Reconnecting…")).toBeNull();
  });
});
